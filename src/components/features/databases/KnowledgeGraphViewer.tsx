import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from "react";
import {
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Upload,
  FileText,
  LayoutGrid,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "../../shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  listKnowledgeGraphs,
  getKnowledgeGraph,
  uploadKnowledgeGraph,
  deleteKnowledgeGraph,
  type KGDocument,
  type KGGraph,
  type KGNode,
} from "../../../services/api";

// ─── Public handle (exposed via useImperativeHandle) ──────────────────────────
export interface KnowledgeGraphViewerHandle {
  triggerUpload: () => void;
}

// ─── Layout constants (mirror DSGraphViewer) ──────────────────────────────────
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;
const SVG_W = 900;
const SVG_H = 500;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const CENTER_W = 170;
const CENTER_H = 46;
const NODE_W = 148;
const NODE_H = 38;
const NODE_R = 8;

// ─── Entity-type colour palette ───────────────────────────────────────────────
type KGNodeType =
  | "Person"
  | "Organization"
  | "Concept"
  | "Product"
  | "Location"
  | "Event"
  | "Other";

const TYPE_COLORS: Record<
  KGNodeType,
  { stroke: string; centerFill: string; connFill: string; text: string; label: string }
> = {
  Person:       { stroke: "#F472B6", centerFill: "#5B1A35", connFill: "#2D0A18", text: "#FBCFE8", label: "#FDA4AF" },
  Organization: { stroke: "#60A5FA", centerFill: "#1E3A5F", connFill: "#0C1F38", text: "#BFDBFE", label: "#93C5FD" },
  Concept:      { stroke: "#818CF8", centerFill: "#312e81", connFill: "#12103A", text: "#E0E7FF", label: "#A5B4FC" },
  Product:      { stroke: "#34D399", centerFill: "#064E3B", connFill: "#052418", text: "#A7F3D0", label: "#6EE7B7" },
  Location:     { stroke: "#FBBF24", centerFill: "#451A03", connFill: "#2A1800", text: "#FDE68A", label: "#FCD34D" },
  Event:        { stroke: "#F97316", centerFill: "#431407", connFill: "#2A1000", text: "#FED7AA", label: "#FCA5A1" },
  Other:        { stroke: "#94A3B8", centerFill: "#1e293b", connFill: "#0a0f1a", text: "#CBD5E1", label: "#64748B" },
};

const DEFAULT_COLORS = TYPE_COLORS.Other;

function getTypeColor(type: string) {
  return TYPE_COLORS[type as KGNodeType] ?? DEFAULT_COLORS;
}

function getNodeStyle(
  type: string,
  isCenter: boolean,
  isConnected: boolean
): { fill: string; stroke: string; textFill: string; labelFill: string } {
  if (isCenter) {
    const c = getTypeColor(type);
    return { fill: c.centerFill, stroke: c.stroke, textFill: c.text, labelFill: c.label };
  }
  if (isConnected) {
    const c = getTypeColor(type);
    return { fill: c.connFill, stroke: c.stroke, textFill: c.text, labelFill: c.label };
  }
  return { fill: "#0a0f1a", stroke: "#1e293b", textFill: "#475569", labelFill: "#334155" };
}

// ─── Helper: format ISO date ──────────────────────────────────────────────────
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Helper: count entity types ───────────────────────────────────────────────
function countTypes(nodes: KGNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.type] = (counts[n.type] ?? 0) + 1;
  }
  return counts;
}

// ─── Helper: deduplicate Other vs typed twins ──────────────────────────────
// The LLM often emits every entity twice — once as a typed node (Person,
// Organization, …) and once as an "Other" copy with a different id but the
// same label.  All edges tend to reference the Other id.  This function:
//   1. Builds a label → typed-node-id map (ignoring Other).
//   2. For every Other node whose label matches a typed twin, records an
//      id-remap: other_id → typed_id.
//   3. Rewrites edge source/target ids using the remap.
//   4. Drops Other nodes that now have no edges (they were pure duplicates).
function normalizeGraph(graph: KGGraph): KGGraph {
  const normalize = (s: string) => s.trim().toLowerCase();

  // Map: normalized label → first typed (non-Other) node
  const labelToTyped = new Map<string, KGNode>();
  for (const n of graph.nodes) {
    if (n.type !== "Other") {
      const key = normalize(n.label);
      if (!labelToTyped.has(key)) labelToTyped.set(key, n);
    }
  }

  // Build remap: Other node id → typed node id (when a twin exists)
  const remap = new Map<string, string>();
  for (const n of graph.nodes) {
    if (n.type === "Other") {
      const typed = labelToTyped.get(normalize(n.label));
      if (typed) remap.set(n.id, typed.id);
    }
  }

  if (remap.size === 0) return graph; // nothing to fix

  // Rewrite edges
  const remapId = (id: string) => remap.get(id) ?? id;
  const edges = graph.edges
    .map((e) => ({ ...e, source: remapId(e.source), target: remapId(e.target) }))
    .filter((e) => e.source !== e.target); // drop self-loops created by merge

  // Dedupe edges (same source+target+label)
  const seen = new Set<string>();
  const dedupedEdges = edges.filter((e) => {
    const key = `${e.source}|${e.target}|${e.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Keep nodes that are referenced by at least one edge OR are not Other duplicates
  const referencedIds = new Set<string>(
    dedupedEdges.flatMap((e) => [e.source, e.target])
  );
  const nodes = graph.nodes.filter(
    (n) => !remap.has(n.id) || referencedIds.has(n.id)
  );

  return {
    ...graph,
    nodes,
    edges: dedupedEdges,
    stats: {
      ...graph.stats,
      node_count: nodes.length,
      edge_count: dedupedEdges.length,
    },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export const KnowledgeGraphViewer = forwardRef<KnowledgeGraphViewerHandle>(
  function KnowledgeGraphViewer(_props, ref) {
    // ── document list state ──
    const [documents, setDocuments] = useState<KGDocument[]>([]);
    const [isLoadingDocs, setIsLoadingDocs] = useState(true);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
    const [docSearch, setDocSearch] = useState("");

    // ── graph state ──
    const [graphData, setGraphData] = useState<KGGraph | null>(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(false);
    const [graphError, setGraphError] = useState<string | null>(null);

    // ── node selection state ──
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [nodeSearch, setNodeSearch] = useState("");
    const [activeDetailsTab, setActiveDetailsTab] = useState<"overview" | "properties">("overview");

    // ── canvas state ──
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    // ── delete state ──
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

    // ── upload state ──
    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Expose triggerUpload to parent (DatabasesView header button)
    useImperativeHandle(ref, () => ({
      triggerUpload: () => {
        setUploadFile(null);
        setUploadError(null);
        setUploadOpen(true);
      },
    }));

    // ── load document list on mount ──
    const loadDocuments = useCallback(async () => {
      setIsLoadingDocs(true);
      const res = await listKnowledgeGraphs();
      setIsLoadingDocs(false);
      if (res.success && res.data) {
        const items = res.data.items;
        setDocuments(items);
        // Auto-select newest
        if (items.length > 0 && !selectedDocId) {
          setSelectedDocId(items[0].graph_id);
        }
      } else {
        toast.error(res.error?.message ?? "Failed to load documents");
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      loadDocuments();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── load graph when selected document changes ──
    useEffect(() => {
      if (!selectedDocId) {
        setGraphData(null);
        setSelectedNodeId(null);
        return;
      }
      let cancelled = false;
      setIsLoadingGraph(true);
      setGraphError(null);
      setGraphData(null);
      setSelectedNodeId(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });

      getKnowledgeGraph(selectedDocId).then((res) => {
        if (cancelled) return;
        setIsLoadingGraph(false);
        if (res.success && res.data) {
          const normalized = normalizeGraph(res.data.graph);
          setGraphData(normalized);
          // Auto-select first node that has at least one edge
          const firstConnected = normalized.nodes.find((n) =>
            normalized.edges.some((e) => e.source === n.id || e.target === n.id)
          ) ?? normalized.nodes[0];
          if (firstConnected) setSelectedNodeId(firstConnected.id);
        } else {
          setGraphError(res.error?.message ?? "Failed to load graph");
        }
      });

      return () => { cancelled = true; };
    }, [selectedDocId]);

    // ── computed graph data ──
    const selectedNode = useMemo(
      () => graphData?.nodes.find((n) => n.id === selectedNodeId) ?? null,
      [graphData, selectedNodeId]
    );

    const relatedEdges = useMemo(() => {
      if (!selectedNodeId || !graphData) return { outgoing: [], incoming: [], all: [] };
      const outgoing = graphData.edges.filter((e) => e.source === selectedNodeId);
      const incoming = graphData.edges.filter((e) => e.target === selectedNodeId);
      return { outgoing, incoming, all: [...outgoing, ...incoming] };
    }, [selectedNodeId, graphData]);

    const connectedIds = useMemo(
      () =>
        new Set(
          relatedEdges.all
            .flatMap((e) => [e.source, e.target])
            .filter((id) => id !== selectedNodeId)
        ),
      [relatedEdges, selectedNodeId]
    );

    // ── radial layout (same algorithm as DSGraphViewer) ──
    const { nodePositions, suggestedZoom } = useMemo(() => {
      if (!graphData || !selectedNodeId) {
        return { nodePositions: new Map(), suggestedZoom: 1 };
      }
      const neighborNodes = graphData.nodes.filter(
        (n) => n.id !== selectedNodeId && connectedIds.has(n.id)
      );
      const count = neighborNodes.length;
      const minGap = NODE_W + 28;
      const properRadius = count <= 1 ? 190 : minGap / (2 * Math.tan(Math.PI / count));
      const radius = Math.max(190, properRadius);

      const positions = new Map<string, { x: number; y: number; w: number; h: number }>();
      positions.set(selectedNodeId, { x: CX, y: CY, w: CENTER_W, h: CENTER_H });

      neighborNodes.forEach((node, i) => {
        const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        positions.set(node.id, {
          x: CX + radius * Math.cos(angle),
          y: CY + radius * Math.sin(angle),
          w: NODE_W,
          h: NODE_H,
        });
      });

      const extent = radius + NODE_W * 0.6 + 16;
      const fitScale = count === 0 ? 1 : Math.min(1, Math.min(CX, CY) / extent);
      return { nodePositions: positions, suggestedZoom: Math.max(0.28, fitScale) };
    }, [selectedNodeId, graphData, connectedIds]);

    // Auto-fit zoom when selected node changes
    const prevNodeRef = useRef(selectedNodeId);
    useEffect(() => {
      if (prevNodeRef.current !== selectedNodeId) {
        prevNodeRef.current = selectedNodeId;
        setOffset({ x: CX * (1 - suggestedZoom), y: CY * (1 - suggestedZoom) });
        setZoom(suggestedZoom);
      }
    }, [selectedNodeId, suggestedZoom]);

    // ── bezier edge path (identical to DSGraphViewer) ──
    const getEdgePath = (sourceId: string, targetId: string) => {
      const src = nodePositions.get(sourceId);
      const tgt = nodePositions.get(targetId);
      if (!src || !tgt) return null;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return null;
      const ux = dx / dist;
      const uy = dy / dist;
      const startX = src.x + ux * (src.w / 2 + 2);
      const startY = src.y + uy * (src.h / 2 + 2);
      const endX = tgt.x - ux * (tgt.w / 2 + 9);
      const endY = tgt.y - uy * (tgt.h / 2 + 9);
      // Near-horizontal edges (|uy| < 0.4) overlap node boxes with minimal curve.
      // Use a larger perpendicular bend so the label clears the node height.
      const isNearHorizontal = Math.abs(uy) < 0.4;
      const curveAmt = isNearHorizontal
        ? Math.min(dist * 0.32, 60)
        : Math.min(dist * 0.18, 32);
      const mx = (startX + endX) / 2 - uy * curveAmt;
      const my = (startY + endY) / 2 + ux * curveAmt;
      // Place label at the apex (control point) so it sits at the peak of the
      // curve — well clear of both node boxes on horizontal/near-horizontal edges.
      return { path: `M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`, lx: mx, ly: my };
    };

    // nodeSearch filters are applied inline in the SVG map below

    // ── filtered document list ──
    const filteredDocs = useMemo(() => {
      const q = docSearch.trim().toLowerCase();
      return documents.filter((d) => !q || d.filename.toLowerCase().includes(q));
    }, [documents, docSearch]);

    // ── canvas handlers (mirror DSGraphViewer) ──
    const handleWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z + delta).toFixed(2)))));
    };

    const beginPan: React.MouseEventHandler<SVGSVGElement> = (e) => {
      if ((e.target as SVGElement).closest("[data-node='true']")) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    };

    const onPanMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
      if (!isPanning || !panStart.current) return;
      setOffset({
        x: panStart.current.ox + (e.clientX - panStart.current.x),
        y: panStart.current.oy + (e.clientY - panStart.current.y),
      });
    };

    const endPan = () => {
      setIsPanning(false);
      panStart.current = null;
    };

    const resetView = () => {
      setZoom(suggestedZoom);
      setOffset({ x: CX * (1 - suggestedZoom), y: CY * (1 - suggestedZoom) });
    };

    // ── delete handler ──
    const handleDelete = async () => {
      if (!deleteConfirmId) return;
      const idToDelete = deleteConfirmId;
      setDeleteConfirmId(null);
      setIsDeletingId(idToDelete);
      const res = await deleteKnowledgeGraph(idToDelete);
      setIsDeletingId(null);
      if (res.success) {
        toast.success("Knowledge graph deleted");
        const updated = documents.filter((d) => d.graph_id !== idToDelete);
        setDocuments(updated);
        if (selectedDocId === idToDelete) {
          setSelectedDocId(updated.length > 0 ? updated[0].graph_id : null);
        }
      } else {
        toast.error(res.error?.message ?? "Failed to delete knowledge graph");
      }
    };

    // ── upload helpers ──
    const friendlyError = (msg: string | undefined): string => {
      if (!msg) return "Upload failed. Please try again.";
      const m = msg.toLowerCase();
      if (m.includes("429") || m.includes("quota") || m.includes("resource_exhausted"))
        return "AI quota exceeded. Please try again in a moment.";
      if (m.includes("502") || m.includes("extraction failed"))
        return "Extraction failed. Please try again.";
      if (m.includes("20 mb") || m.includes("file exceeds"))
        return "File is too large. Maximum size is 20 MB.";
      if (m.includes("page") && m.includes("limit"))
        return "Document exceeds the 20-page limit.";
      if (m.includes("unsupported") || m.includes("only pdf"))
        return "Only PDF and DOCX files are accepted.";
      // For short messages (already user-friendly), pass through; truncate long ones
      return msg.length > 80 ? "Upload failed. Please try again." : msg;
    };

    const validateFile = (file: File): string | null => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx"].includes(ext ?? ""))
        return "Only PDF and DOCX files are accepted.";
      if (file.size > 20 * 1024 * 1024)
        return "File must be under 20 MB.";
      return null;
    };

    const handleFileSelect = (file: File) => {
      const err = validateFile(file);
      if (err) {
        setUploadError(err);
        setUploadFile(null);
      } else {
        setUploadError(null);
        setUploadFile(file);
      }
    };

    const handleUploadSubmit = async () => {
      if (!uploadFile) return;
      setIsUploading(true);
      setUploadError(null);
      const res = await uploadKnowledgeGraph(uploadFile);
      if (!res.success || !res.data) {
        setIsUploading(false);
        setUploadError(friendlyError(res.error?.message));
        return;
      }
      const graphId = res.data.graph_id;
      // Fetch the newly created graph
      const detail = await getKnowledgeGraph(graphId);
      setIsUploading(false);
      if (!detail.success || !detail.data) {
        toast.error("Graph uploaded but failed to load. Please refresh.");
        setUploadOpen(false);
        loadDocuments();
        return;
      }
      const newDoc: KGDocument = {
        graph_id: detail.data.graph_id,
        filename: detail.data.filename,
        page_count: detail.data.page_count,
        created_at: detail.data.created_at,
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDocId(graphId);
      setUploadOpen(false);
      setUploadFile(null);
      toast.success(`"${newDoc.filename}" uploaded and graph ready.`);
    };

    // ── selected document metadata ──
    const selectedDoc = useMemo(
      () => documents.find((d) => d.graph_id === selectedDocId) ?? null,
      [documents, selectedDocId]
    );

    const typeCounts = useMemo(
      () => (graphData ? countTypes(graphData.nodes) : {}),
      [graphData]
    );

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────
    return (
      <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card">

        {/* ══════════════ LEFT: Document List ══════════════ */}
        <div className="w-52 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <span className="text-[13px] font-semibold text-foreground">Uploaded Documents</span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
              {documents.length}
            </span>
          </div>

          {/* Document search */}
          <div className="px-3 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
                placeholder="Search documents..."
                value={docSearch}
                onChange={(e) => setDocSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Document list */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
            {isLoadingDocs ? (
              /* Skeleton loaders */
              <div className="space-y-1.5 pt-1">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 rounded-md bg-muted/30 animate-pulse" />
                ))}
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-2 text-center">
                <BookOpen className="w-6 h-6 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  {documents.length === 0 ? "No Knowledge Graphs" : "No results"}
                </p>
                {documents.length === 0 && (
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Upload a PDF or DOCX to get started.
                  </p>
                )}
              </div>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = doc.graph_id === selectedDocId;
                const isDeleting = doc.graph_id === isDeletingId;
                return (
                  <button
                    key={doc.graph_id}
                    className={`w-full flex items-start gap-2 px-2 py-2 rounded-md text-left transition-colors mb-0.5 group ${
                      isSelected
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "hover:bg-muted/50 text-foreground"
                    } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
                    onClick={() => {
                      setSelectedDocId(doc.graph_id);
                      setSelectedNodeId(null);
                      setActiveDetailsTab("overview");
                    }}
                    disabled={isDeleting}
                  >
                    <div
                      className={`w-6 h-6 rounded shrink-0 flex items-center justify-center mt-0.5 ${
                        isSelected ? "bg-primary/30" : "bg-muted/50"
                      }`}
                    >
                      <FileText className={`w-3 h-3 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[13px] truncate block leading-tight">
                        {doc.filename}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {doc.page_count} {doc.page_count === 1 ? "page" : "pages"} · {formatDate(doc.created_at)}
                      </span>
                    </div>
                    {/* Delete icon — visible on hover */}
                    <button
                      className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(doc.graph_id);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                );
              })
            )}
          </div>

          {/* Bottom stats */}
          <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
            <div className="grid grid-cols-2 gap-1 text-center">
              <div className="rounded bg-muted/30 py-1">
                <p className="text-[13px] font-semibold text-foreground">
                  {graphData?.stats.node_count ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">Nodes</p>
              </div>
              <div className="rounded bg-muted/30 py-1">
                <p className="text-[13px] font-semibold text-foreground">
                  {graphData?.stats.edge_count ?? "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">Relations</p>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════ CENTER: Graph Canvas ══════════════ */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a] overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-2.5 px-4 py-2 border-b border-border/50 shrink-0 bg-[#06101e] h-11">
            {/* Relationship filter pill */}
            <div className="flex items-center gap-2 h-8 px-3 text-[12px] font-medium text-muted-foreground border border-border/50 rounded-md bg-muted/10 select-none shrink-0">
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span>Direct Relationships</span>
            </div>

            <div className="w-px h-5 bg-border/40 shrink-0" />

            {/* Node search */}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70 pointer-events-none" />
              <input
                className="h-8 pl-8 pr-3 text-[12px] rounded-md border border-border/50 bg-[#0a1525] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 w-44 transition-colors"
                placeholder="Search nodes…"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
              />
            </div>

            <div className="flex-1" />

            {/* Zoom controls */}
            <div className="flex items-center gap-1">
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))))}
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-muted-foreground min-w-[36px] text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))))}
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                className="h-7 w-7 flex items-center justify-center rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors ml-0.5"
                onClick={resetView}
                title="Reset view"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Graph area */}
          <div className="flex-1 relative min-h-0 overflow-hidden">
            {isLoadingGraph ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span className="text-sm">Loading graph…</span>
              </div>
            ) : graphError ? (
              <div className="absolute inset-0 flex items-center justify-center text-destructive text-sm px-8 text-center">
                {graphError}
              </div>
            ) : !graphData ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <BookOpen className="w-10 h-10 opacity-30" />
                <p className="text-sm">Select a document to view its knowledge graph.</p>
              </div>
            ) : graphData.nodes.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                No entities extracted from this document.
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className={`w-full h-full ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
                onWheel={handleWheel}
                onMouseDown={beginPan}
                onMouseMove={onPanMove}
                onMouseUp={endPan}
                onMouseLeave={endPan}
              >
                <defs>
                  <marker id="kg-arrow-out" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                    <path d="M0,0.5 L8.5,4 L0,7.5" fill="none" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                  <marker id="kg-arrow-in" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                    <path d="M0,0.5 L8.5,4 L0,7.5" fill="none" stroke="#38BDF8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                  <filter id="kg-glow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="kg-shadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
                  </filter>
                </defs>

                <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                  {/* Edges */}
                  {relatedEdges.all.map((edge) => {
                    const result = getEdgePath(edge.source, edge.target);
                    if (!result) return null;
                    const isOutgoing = edge.source === selectedNodeId;
                    const strokeColor = isOutgoing ? "#818CF8" : "#38BDF8";
                    const markerId = isOutgoing ? "url(#kg-arrow-out)" : "url(#kg-arrow-in)";
                    const rawLabel = edge.label ?? "";
                    const displayLabel = rawLabel.length > 18 ? `${rawLabel.slice(0, 17)}…` : rawLabel;
                    const labelW = displayLabel.length * 5.8 + 10;

                    return (
                      <g key={edge.id}>
                        <path
                          d={result.path}
                          fill="none"
                          stroke={strokeColor}
                          strokeOpacity="0.12"
                          strokeWidth="5"
                        />
                        <path
                          d={result.path}
                          fill="none"
                          stroke={strokeColor}
                          strokeOpacity="0.75"
                          strokeWidth="1.5"
                          markerEnd={markerId}
                        />
                        {displayLabel && (
                          <g>
                            <rect
                              x={result.lx - labelW / 2}
                              y={result.ly - 9}
                              width={labelW}
                              height={13}
                              rx={4}
                              fill="#080e1c"
                              fillOpacity="0.88"
                              stroke={strokeColor}
                              strokeOpacity="0.28"
                              strokeWidth="0.8"
                            />
                            <text
                              x={result.lx}
                              y={result.ly + 1}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="8.5"
                              fill={strokeColor}
                              fillOpacity="0.95"
                              className="select-none"
                              fontFamily="monospace"
                            >
                              {displayLabel}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Nodes */}
                  {graphData.nodes.map((node) => {
                    const pos = nodePositions.get(node.id);
                    // Show all nodes but make unconnected ones invisible (same radius trick)
                    if (!pos) return null;
                    const isCenter = node.id === selectedNodeId;
                    const isConnected = connectedIds.has(node.id);

                    // For node search: dim non-matching when search active
                    const matchesSearch =
                      !nodeSearch ||
                      node.label.toLowerCase().includes(nodeSearch.toLowerCase()) ||
                      node.type.toLowerCase().includes(nodeSearch.toLowerCase());
                    if (!isCenter && !isConnected) return null; // only show center + neighbors
                    if (nodeSearch && !matchesSearch && !isCenter) return null;

                    const style = getNodeStyle(node.type, isCenter, isConnected);
                    const nx = pos.x - pos.w / 2;
                    const ny = pos.y - pos.h / 2;
                    const truncLabel = node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label;
                    const truncType = node.type.length > 14 ? `${node.type.slice(0, 14)}…` : node.type;
                    const iconSize = pos.h - 10;
                    const iconX = nx + 6;
                    const iconY = ny + 5;
                    const iconBg = isCenter
                      ? getTypeColor(node.type).centerFill
                      : getTypeColor(node.type).connFill;
                    const iconAccent = style.stroke;
                    const textX = nx + iconSize + 14;

                    return (
                      <g
                        key={node.id}
                        data-node="true"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setActiveDetailsTab("overview");
                        }}
                        style={{ cursor: "pointer" }}
                        filter={isCenter ? "url(#kg-glow)" : "url(#kg-shadow)"}
                      >
                        <rect
                          x={nx}
                          y={ny}
                          width={pos.w}
                          height={pos.h}
                          rx={NODE_R}
                          fill={style.fill}
                          stroke={style.stroke}
                          strokeWidth={isCenter ? 1.8 : 1}
                        />
                        {/* Type-colored top strip */}
                        <rect
                          x={nx}
                          y={ny}
                          width={pos.w}
                          height={isCenter ? 4 : 3}
                          rx={NODE_R}
                          fill={style.stroke}
                          fillOpacity="0.7"
                        />
                        {/* Entity icon background */}
                        <rect x={iconX} y={iconY} width={iconSize} height={iconSize} rx={4} fill={iconBg} />
                        {/* Letter initial */}
                        <text
                          x={iconX + iconSize / 2}
                          y={iconY + iconSize / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={iconSize * 0.55}
                          fontWeight="700"
                          fill={iconAccent}
                          fillOpacity="0.9"
                          className="select-none"
                        >
                          {node.type.charAt(0)}
                        </text>
                        {/* Primary label */}
                        <text
                          x={textX}
                          y={ny + (isCenter ? 18 : 15)}
                          fontSize={isCenter ? "11" : "10"}
                          fontWeight={isCenter ? "700" : "500"}
                          fill={style.textFill}
                          className="select-none"
                        >
                          {truncLabel}
                        </text>
                        {/* Sub-label (type) */}
                        <text
                          x={textX}
                          y={ny + (isCenter ? 31 : 27)}
                          fontSize="8.5"
                          fill={style.labelFill}
                          className="select-none"
                        >
                          {isCenter ? truncType : truncType}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            {/* Entity Type Legend */}
            {graphData && graphData.nodes.length > 0 && (
              <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-x-4 gap-y-1">
                {(Object.keys(TYPE_COLORS) as KGNodeType[])
                  .filter((t) => typeCounts[t])
                  .map((t) => (
                    <div key={t} className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: TYPE_COLORS[t].stroke }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {t} ({typeCounts[t]})
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* ══════════════ RIGHT: Details Panel ══════════════ */}
        <div className="w-[280px] shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
          {selectedNode ? (
            /* ── Node selected: show node details ── */
            <>
              {/* Node header — no bottom border so no line above tabs */}
              <div className="px-4 pt-4 pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg border-2 flex items-center justify-center shrink-0 text-[13px] font-bold"
                    style={{
                      background: getTypeColor(selectedNode.type).centerFill,
                      borderColor: getTypeColor(selectedNode.type).stroke + "50",
                      color: getTypeColor(selectedNode.type).stroke,
                    }}
                  >
                    {selectedNode.type.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground leading-tight truncate" title={selectedNode.label}>
                      {selectedNode.label}
                    </p>
                    <span
                      className="inline-flex items-center px-1.5 py-px rounded text-[11px] font-medium mt-1"
                      style={{
                        background: getTypeColor(selectedNode.type).centerFill,
                        color: getTypeColor(selectedNode.type).stroke,
                        border: `1px solid ${getTypeColor(selectedNode.type).stroke}35`,
                      }}
                    >
                      {selectedNode.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Overview / Properties tabs — border-b-2 -mb-px for correct underline position */}
              <div className="flex border-b border-border/60 shrink-0">
                {(["overview", "properties"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDetailsTab(tab)}
                    className={`flex-1 text-[13px] font-medium py-2 transition-colors duration-150 border-b-2 -mb-px ${
                      activeDetailsTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "overview" ? "Overview" : "Properties"}
                  </button>
                ))}
              </div>

              {/*
                Layout anchor: Overview always stays rendered (defines the panel height).
                Properties overlays it absolutely so the panel never shrinks.
              */}
              <div className="relative overflow-y-auto">

                {/* ── OVERVIEW — always in DOM, defines the container height ── */}
                <div className={`px-4 py-3 flex flex-col gap-4 ${activeDetailsTab !== "overview" ? "opacity-0 pointer-events-none select-none" : ""}`}>

                  {/* Relationship count cards */}
                  <div>
                    <p className="text-[13px] font-semibold text-foreground mb-2">Direct Relationships</p>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                        <p className="text-[18px] font-bold text-[#818CF8] leading-none">{relatedEdges.outgoing.length}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Outgoing</p>
                      </div>
                      <div className="flex-1 rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                        <p className="text-[18px] font-bold text-[#38BDF8] leading-none">{relatedEdges.incoming.length}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">Incoming</p>
                      </div>
                    </div>
                  </div>

                  {/* Outgoing relationships */}
                  {relatedEdges.outgoing.length > 0 && (
                    <div>
                      <p className="text-[13px] font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#818CF8]" />
                        <span>Outgoing</span>
                        <span className="text-[13px] text-muted-foreground font-normal">({selectedNode.label} → Other)</span>
                      </p>
                      <div className="space-y-0.5">
                        {relatedEdges.outgoing.slice(0, 12).map((edge) => {
                          const targetNode = graphData?.nodes.find((n) => n.id === edge.target);
                          return (
                            <button
                              key={edge.id}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/25 transition-colors group text-left"
                              onClick={() => { setSelectedNodeId(edge.target); setActiveDetailsTab("overview"); }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: getTypeColor(targetNode?.type ?? "Other").stroke }} />
                              <span className="text-[13px] text-foreground truncate flex-1 min-w-0">{targetNode?.label ?? edge.target}</span>
                              <span className="text-[11px] text-muted-foreground/70 shrink-0 font-mono">{edge.label}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                            </button>
                          );
                        })}
                        {relatedEdges.outgoing.length > 12 && (
                          <p className="text-[13px] text-muted-foreground px-2.5 pt-1">+{relatedEdges.outgoing.length - 12} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Incoming relationships */}
                  {relatedEdges.incoming.length > 0 && (
                    <div>
                      <p className="text-[13px] font-semibold text-foreground mb-2 flex items-center gap-1.5">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Incoming</span>
                        <span className="text-[13px] text-muted-foreground font-normal">(Other → {selectedNode.label})</span>
                      </p>
                      <div className="space-y-0.5">
                        {relatedEdges.incoming.slice(0, 12).map((edge) => {
                          const sourceNode = graphData?.nodes.find((n) => n.id === edge.source);
                          return (
                            <button
                              key={edge.id}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/25 transition-colors group text-left"
                              onClick={() => { setSelectedNodeId(edge.source); setActiveDetailsTab("overview"); }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: getTypeColor(sourceNode?.type ?? "Other").stroke }} />
                              <span className="text-[13px] text-foreground truncate flex-1 min-w-0">{sourceNode?.label ?? edge.source}</span>
                              <span className="text-[11px] text-muted-foreground/70 shrink-0 font-mono">{edge.label}</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                            </button>
                          );
                        })}
                        {relatedEdges.incoming.length > 12 && (
                          <p className="text-[13px] text-muted-foreground px-2.5 pt-1">+{relatedEdges.incoming.length - 12} more</p>
                        )}
                      </div>
                    </div>
                  )}

                  {relatedEdges.all.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-[13px] text-muted-foreground">No relationships found for this node.</p>
                    </div>
                  )}
                </div>

                {/* ── PROPERTIES — overlaid absolutely, never affects container height ── */}
                {activeDetailsTab === "properties" && (
                  <div className="absolute inset-0 bg-card overflow-y-auto px-4 py-3 space-y-3">
                    {[
                      { label: "Label", value: selectedNode.label },
                      { label: "Type", value: selectedNode.type },
                      { label: "Node ID", value: selectedNode.id },
                      { label: "Outgoing", value: String(relatedEdges.outgoing.length) },
                      { label: "Incoming", value: String(relatedEdges.incoming.length) },
                      { label: "Total Relations", value: String(relatedEdges.all.length) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5">
                        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
                        <p className="text-[13px] text-foreground truncate" title={value}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}

              </div>{/* relative scroll container */}

              {/* View Graph Summary footer */}
              <div className="px-3 py-2.5 border-t border-border/60 shrink-0">
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-border/50 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                  onClick={() => setSelectedNodeId(null)}
                >
                  View Graph Summary
                </button>
              </div>
            </>
          ) : (
            /* ── No node selected: graph/document summary ── */
            <div className="flex-1 min-h-0 overflow-y-auto">
              {!selectedDoc ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 text-center">
                  <BookOpen className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-[13px]">Select a document from the sidebar.</p>
                </div>
              ) : (
                <div className="px-4 py-3 flex flex-col gap-4">
                  {/* Document info header */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground leading-tight truncate" title={selectedDoc.filename}>
                        {selectedDoc.filename}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Knowledge Graph</p>
                    </div>
                  </div>

                  {/* Document metadata */}
                  <div>
                    <p className="text-[13px] font-semibold text-foreground mb-2">Document Info</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "Upload Date", value: formatDate(selectedDoc.created_at) },
                        { label: "Page Count", value: `${selectedDoc.page_count} ${selectedDoc.page_count === 1 ? "page" : "pages"}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                          <span className="text-[13px] text-muted-foreground">{label}</span>
                          <span className="text-[13px] text-foreground font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Graph statistics */}
                  {graphData && (
                    <>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground mb-2">Graph Statistics</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                            <p className="text-[18px] font-bold text-primary leading-none">{graphData.stats.node_count}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Nodes</p>
                          </div>
                          <div className="rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                            <p className="text-[18px] font-bold text-accent leading-none">{graphData.stats.edge_count}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Relations</p>
                          </div>
                        </div>
                      </div>

                      {/* Entity type breakdown */}
                      {Object.keys(typeCounts).length > 0 && (
                        <div>
                          <p className="text-[13px] font-semibold text-foreground mb-2">Entity Types</p>
                          <div className="space-y-2">
                            {(Object.entries(typeCounts) as [string, number][])
                              .sort(([, a], [, b]) => b - a)
                              .map(([type, count]) => {
                                const pct = graphData.stats.node_count > 0
                                  ? Math.round((count / graphData.stats.node_count) * 100)
                                  : 0;
                                const color = getTypeColor(type).stroke;
                                return (
                                  <div key={type}>
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                        <span className="text-[13px] text-foreground">{type}</span>
                                      </div>
                                      <span className="text-[13px] text-muted-foreground">{count}</span>
                                    </div>
                                    <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ width: `${pct}%`, background: color }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {isLoadingGraph && (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-6 rounded bg-muted/30 animate-pulse" />
                      ))}
                    </div>
                  )}

                  {graphData && graphData.nodes.length > 0 && (
                    <p className="text-[13px] text-muted-foreground text-center pt-1 border-t border-border/40">
                      Click a node in the graph to view its details.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══════════════ Delete Confirmation ══════════════ */}
        <ConfirmDialog
          open={deleteConfirmId !== null}
          onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
          title="Delete Knowledge Graph"
          description={`Are you sure you want to delete "${
            documents.find((d) => d.graph_id === deleteConfirmId)?.filename ?? "this graph"
          }"? This cannot be undone.`}
          onConfirm={handleDelete}
          confirmText="Delete"
          variant="destructive"
        />

        {/* ══════════════ Upload Dialog ══════════════ */}
        <Dialog open={uploadOpen} onOpenChange={(open) => { if (!isUploading) setUploadOpen(open); }}>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => { if (isUploading) e.preventDefault(); }}>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a PDF or DOCX file. The system will extract entities and relationships automatically.
              </DialogDescription>
            </DialogHeader>

            {/* Drop zone */}
            <div
              className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : uploadFile
                  ? "border-success/60 bg-success/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/20"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileSelect(file);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = "";
                }}
              />
              {uploadFile ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 text-success" />
                  <p className="text-sm font-medium text-foreground">{uploadFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={(e) => { e.stopPropagation(); setUploadFile(null); setUploadError(null); }}
                  >
                    Change file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <p className="text-sm text-foreground">Drop a file here or click to browse</p>
                  <p className="text-xs text-muted-foreground">PDF or DOCX · max 20 MB · max 20 pages</p>
                </div>
              )}
            </div>

            {/* Validation error */}
            {uploadError && (
              <p className="text-xs text-destructive mt-2 truncate" title={uploadError}>
                {uploadError}
              </p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                onClick={() => setUploadOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded-md bg-gradient-to-r from-primary to-accent text-white hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                onClick={handleUploadSubmit}
                disabled={!uploadFile || isUploading}
              >
                {isUploading && (
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                )}
                {isUploading ? "Processing…" : "Upload & Build Graph"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);
