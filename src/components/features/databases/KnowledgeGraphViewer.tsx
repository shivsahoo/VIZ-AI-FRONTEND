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
  BookOpen,
  Maximize2,
  Crosshair,
  Tag,
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

// ─── Layout constants ─────────────────────────────────────────────────────────
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;
const SVG_W = 900;
const SVG_H = 500;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const CENTER_W = 172;
const CENTER_H = 50;
const NODE_W = 150;
const NODE_H = 44;
const NODE_R = 12;

// Progressive-detail zoom thresholds (Neo4j-Bloom-style level of detail)
const ZOOM_SHOW_SUBTITLE = 0.6;   // below this, hide the type subtitle
const ZOOM_SHOW_EDGE_LABELS = 1.15; // above this, reveal all edge labels

// ─── Entity-type colour palette (muted enterprise tones) ──────────────────────
type KGNodeType =
  | "Person"
  | "Organization"
  | "Concept"
  | "Product"
  | "Location"
  | "Event"
  | "Other";

// Each entry: accent (border/icon), gradient fill (from→to), text + subtitle,
// and a soft glow colour.  Backwards-compatible keys (stroke/centerFill/
// connFill/text/label) are kept so existing consumers keep working.
interface TypePalette {
  stroke: string;      // accent / border  (== accent)
  centerFill: string;  // gradient top     (== gradFrom)
  connFill: string;    // gradient bottom  (== gradTo)
  text: string;        // primary label
  label: string;       // subtitle
  gradFrom: string;
  gradTo: string;
  glow: string;
}

const TYPE_COLORS: Record<KGNodeType, TypePalette> = {
  Organization: { stroke: "#5B9DF0", centerFill: "#182C45", connFill: "#101E30", text: "#DCEAFE", label: "#9DC2F0", gradFrom: "#1B3350", gradTo: "#111E30", glow: "#5B9DF0" },
  Person:       { stroke: "#A78BFA", centerFill: "#271E42", connFill: "#181330", text: "#E9E3FB", label: "#C4B4F0", gradFrom: "#2A2148", gradTo: "#171330", glow: "#A78BFA" },
  Location:     { stroke: "#E0A94A", centerFill: "#332614", connFill: "#231A0D", text: "#F6E5C4", label: "#D9BE84", gradFrom: "#392A16", gradTo: "#241A0D", glow: "#E0A94A" },
  Product:      { stroke: "#3FB98C", centerFill: "#13332A", connFill: "#0C2119", text: "#CFF2E5", label: "#88D9BD", gradFrom: "#153A2E", gradTo: "#0C2119", glow: "#3FB98C" },
  Concept:      { stroke: "#7C87F0", centerFill: "#1F2245", connFill: "#161832", text: "#E1E4FB", label: "#AAB0F0", gradFrom: "#23264C", gradTo: "#161832", glow: "#7C87F0" },
  Event:        { stroke: "#EC8B4B", centerFill: "#341F12", connFill: "#23150B", text: "#F7E1CB", label: "#E5B183", gradFrom: "#3A2214", gradTo: "#23150B", glow: "#EC8B4B" },
  Other:        { stroke: "#8595AB", centerFill: "#1C2634", connFill: "#131B26", text: "#D5DEEA", label: "#93A2B5", gradFrom: "#212C3B", gradTo: "#131B26", glow: "#8595AB" },
};

const DEFAULT_COLORS = TYPE_COLORS.Other;

function getTypeColor(type: string): TypePalette {
  return TYPE_COLORS[type as KGNodeType] ?? DEFAULT_COLORS;
}

// Neutral colour used for faded / unrelated nodes in focus mode.
const MUTED_STROKE = "#26303f";

// ─── Smart label wrapping (up to 2 lines, ellipsis + tooltip beyond) ─────────
function wrapLabel(label: string, maxCharsPerLine: number, maxLines: number): string[] {
  const clean = label.trim();
  if (clean.length <= maxCharsPerLine) return [clean];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  // Whatever remains that didn't fit → ellipsize the final line
  const consumed = lines.join(" ").length;
  if (consumed < clean.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    if (last.length > maxCharsPerLine - 1) last = last.slice(0, maxCharsPerLine - 1);
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.length > 0 ? lines : [clean.slice(0, maxCharsPerLine - 1) + "…"];
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

type NodePos = { x: number; y: number; w: number; h: number };
type LayoutResult = {
  positions: Map<string, NodePos>;
  suggestedZoom: number;
  center: { x: number; y: number };
};

/**
 * Deterministic force-directed layout tuned for readability (Neo4j-Bloom style):
 *   • strong repulsion + long links so the graph spreads out
 *   • category cohesion so same-type nodes drift into loose clusters
 *   • hard collision resolution so no two node cards ever overlap
 * Returns a fit zoom + the layout centre so the caller can frame the graph.
 */
function computeFullGraphLayout(
  nodes: KGNode[],
  edges: { source: string; target: string }[]
): LayoutResult {
  const positions = new Map<string, NodePos>();
  if (nodes.length === 0) {
    return { positions, suggestedZoom: 1, center: { x: CX, y: CY } };
  }
  if (nodes.length === 1) {
    positions.set(nodes[0].id, { x: CX, y: CY, w: CENTER_W, h: CENTER_H });
    return { positions, suggestedZoom: 1, center: { x: CX, y: CY } };
  }

  const n = nodes.length;
  // World scales with node count so dense graphs get more breathing room.
  const spread = Math.sqrt(n) * (NODE_W * 0.95);
  const worldR = Math.max(320, spread);

  // Group node indices by type so we can seed clusters + apply cohesion.
  const typeList = Array.from(new Set(nodes.map((nd) => nd.type)));
  const typeAngle = new Map<string, number>();
  typeList.forEach((t, i) => typeAngle.set(t, (i / typeList.length) * 2 * Math.PI));

  const coords = new Map<string, { x: number; y: number }>();
  nodes.forEach((node, i) => {
    // Seed each node in its type's angular sector for natural clustering.
    const base = typeAngle.get(node.type) ?? 0;
    const jitter = (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.9;
    const angle = base + jitter;
    const r = worldR * (0.45 + 0.55 * (((i * 40503) % 1000) / 1000));
    coords.set(node.id, {
      x: CX + r * Math.cos(angle),
      y: CY + r * Math.sin(angle),
    });
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  const idealLen = Math.max(150, Math.min(260, worldR * 0.5));
  const repulsion = idealLen * idealLen * 1.15;
  const iterations = Math.min(240, 90 + n * 3);
  // Minimum centre-to-centre distances that guarantee no card overlap.
  const minGapX = NODE_W + 34;
  const minGapY = NODE_H + 26;

  for (let iter = 0; iter < iterations; iter++) {
    const t = iter / iterations;
    const alpha = 1 - t;
    const disp = new Map<string, { x: number; y: number }>();
    for (const node of nodes) disp.set(node.id, { x: 0, y: 0 });

    // Node–node repulsion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const pa = coords.get(a.id)!;
        const pb = coords.get(b.id)!;
        let dx = pa.x - pb.x;
        let dy = pa.y - pb.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 0.01) {
          dx = (((i + 1) * 0.37) % 1) - 0.5;
          dy = (((j + 1) * 0.73) % 1) - 0.5;
          dist2 = dx * dx + dy * dy || 0.01;
        }
        const dist = Math.sqrt(dist2);
        const force = (repulsion / dist2) * alpha;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const da = disp.get(a.id)!;
        const db = disp.get(b.id)!;
        da.x += fx;
        da.y += fy;
        db.x -= fx;
        db.y -= fy;
      }
    }

    // Edge attraction (springs)
    for (const link of links) {
      const pa = coords.get(link.source);
      const pb = coords.get(link.target);
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - idealLen) * 0.05 * alpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const da = disp.get(link.source)!;
      const db = disp.get(link.target)!;
      da.x += fx;
      da.y += fy;
      db.x -= fx;
      db.y -= fy;
    }

    // Category cohesion — gently pull each node toward its type centroid.
    const centroid = new Map<string, { x: number; y: number; c: number }>();
    for (const node of nodes) {
      const p = coords.get(node.id)!;
      const g = centroid.get(node.type) ?? { x: 0, y: 0, c: 0 };
      g.x += p.x;
      g.y += p.y;
      g.c += 1;
      centroid.set(node.type, g);
    }
    for (const node of nodes) {
      const g = centroid.get(node.type)!;
      const gx = g.x / g.c;
      const gy = g.y / g.c;
      const p = coords.get(node.id)!;
      const d = disp.get(node.id)!;
      d.x += (gx - p.x) * 0.02 * alpha;
      d.y += (gy - p.y) * 0.02 * alpha;
    }

    // Weak gravity toward canvas centre keeps the graph framed.
    for (const node of nodes) {
      const p = coords.get(node.id)!;
      const d = disp.get(node.id)!;
      d.x += (CX - p.x) * 0.01 * alpha;
      d.y += (CY - p.y) * 0.01 * alpha;
    }

    // Integrate with a capped step.
    const maxDisp = worldR * 0.12 * alpha + 2;
    for (const node of nodes) {
      const p = coords.get(node.id)!;
      const d = disp.get(node.id)!;
      const len = Math.sqrt(d.x * d.x + d.y * d.y) || 1;
      const scale = Math.min(maxDisp, len) / len;
      p.x += d.x * scale;
      p.y += d.y * scale;
    }

    // Collision resolution — push overlapping cards apart (elliptical bound).
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pa = coords.get(nodes[i].id)!;
        const pb = coords.get(nodes[j].id)!;
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const overlapX = minGapX - Math.abs(dx);
        const overlapY = minGapY - Math.abs(dy);
        if (overlapX > 0 && overlapY > 0) {
          // Resolve along the axis of least penetration.
          if (overlapX / minGapX < overlapY / minGapY) {
            const push = (overlapX / 2) * (dx < 0 ? -1 : 1);
            pa.x -= push;
            pb.x += push;
          } else {
            const push = (overlapY / 2) * (dy < 0 ? -1 : 1);
            pa.y -= push;
            pb.y += push;
          }
        }
      }
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    const p = coords.get(node.id)!;
    positions.set(node.id, { x: p.x, y: p.y, w: NODE_W, h: NODE_H });
    minX = Math.min(minX, p.x - NODE_W / 2);
    minY = Math.min(minY, p.y - NODE_H / 2);
    maxX = Math.max(maxX, p.x + NODE_W / 2);
    maxY = Math.max(maxY, p.y + NODE_H / 2);
  }

  const extentX = Math.max(maxX - minX, 1);
  const extentY = Math.max(maxY - minY, 1);
  const fitScale = Math.min((SVG_W * 0.88) / extentX, (SVG_H * 0.86) / extentY);
  return {
    positions,
    suggestedZoom: Math.max(0.25, Math.min(1.1, fitScale)),
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
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
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [labelMode, setLabelMode] = useState<"auto" | "on" | "off">("auto");

    // ── canvas state ──
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const didPanRef = useRef(false);
    const hasFittedGraph = useRef(false);

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
      setNodeSearch("");
      setSummaryOpen(false);
      setLabelMode("auto");
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      hasFittedGraph.current = false;

      getKnowledgeGraph(selectedDocId).then((res) => {
        if (cancelled) return;
        setIsLoadingGraph(false);
        if (res.success && res.data) {
          const normalized = normalizeGraph(res.data.graph);
          setGraphData(normalized);
          // Auto-select the highest-degree node so the initial focus is
          // meaningful and centrally located in the graph.
          const degree = new Map<string, number>();
          for (const e of normalized.edges) {
            degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
            degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
          }
          let hub = normalized.nodes[0];
          let best = -1;
          for (const nd of normalized.nodes) {
            const d = degree.get(nd.id) ?? 0;
            if (d > best) {
              best = d;
              hub = nd;
            }
          }
          if (hub) setSelectedNodeId(hub.id);
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

    const searchQuery = nodeSearch.trim().toLowerCase();

    const matchingNodeIds = useMemo(() => {
      if (!graphData || !searchQuery) return null;
      return new Set(
        graphData.nodes
          .filter(
            (n) =>
              n.label.toLowerCase().includes(searchQuery) ||
              n.type.toLowerCase().includes(searchQuery) ||
              n.id.toLowerCase().includes(searchQuery)
          )
          .map((n) => n.id)
      );
    }, [graphData, searchQuery]);

    const searchMatches = useMemo(() => {
      if (!graphData || !matchingNodeIds) return [];
      return graphData.nodes.filter((n) => matchingNodeIds.has(n.id));
    }, [graphData, matchingNodeIds]);

    // ── full-graph layout (all nodes + edges for the selected document) ──
    const baseLayout = useMemo<LayoutResult>(() => {
      if (!graphData) {
        return {
          positions: new Map<string, NodePos>(),
          suggestedZoom: 1,
          center: { x: CX, y: CY },
        };
      }
      return computeFullGraphLayout(graphData.nodes, graphData.edges);
    }, [graphData]);

    // Base positions are stable across selection so selecting never reflows.
    const nodePositions = baseLayout.positions;
    const suggestedZoom = baseLayout.suggestedZoom;
    const layoutCenter = baseLayout.center;

    // ── adjacency: first-level neighbours of the selected node ──
    const neighborIds = useMemo(() => {
      const first = new Set<string>();
      if (!graphData || !selectedNodeId) return first;
      for (const e of graphData.edges) {
        if (e.source === selectedNodeId) first.add(e.target);
        if (e.target === selectedNodeId) first.add(e.source);
      }
      return first;
    }, [graphData, selectedNodeId]);

    // The node that drives focus/highlight — hover takes visual priority.
    const focusId = hoveredNodeId ?? selectedNodeId;

    const focusNeighborIds = useMemo(() => {
      const s = new Set<string>();
      if (!graphData || !focusId) return s;
      for (const e of graphData.edges) {
        if (e.source === focusId) s.add(e.target);
        if (e.target === focusId) s.add(e.source);
      }
      return s;
    }, [graphData, focusId]);

    // Per-node render size (visual hierarchy). Layout stays fixed; only the
    // drawn card scales, so selecting/hovering never reflows the graph.
    const sizeFor = useCallback(
      (id: string): { w: number; h: number } => {
        if (id === selectedNodeId) return { w: CENTER_W, h: CENTER_H };
        if (neighborIds.has(id)) return { w: NODE_W + 8, h: NODE_H + 3 };
        return { w: NODE_W, h: NODE_H };
      },
      [selectedNodeId, neighborIds]
    );

    // Fit the canvas once when a graph first loads
    useEffect(() => {
      if (!graphData || hasFittedGraph.current) return;
      hasFittedGraph.current = true;
      setOffset({
        x: CX - suggestedZoom * layoutCenter.x,
        y: CY - suggestedZoom * layoutCenter.y,
      });
      setZoom(suggestedZoom);
    }, [graphData, suggestedZoom, layoutCenter]);

    // When the search query changes, jump to the first match (if any).
    const prevSearchQuery = useRef(searchQuery);
    useEffect(() => {
      if (prevSearchQuery.current === searchQuery) return;
      prevSearchQuery.current = searchQuery;
      if (!searchQuery || searchMatches.length === 0) return;
      setSelectedNodeId((current) => {
        if (current && searchMatches.some((n) => n.id === current)) return current;
        return searchMatches[0].id;
      });
      setActiveDetailsTab("overview");
    }, [searchQuery, searchMatches]);

    // ── bezier edge path (uses render sizes so anchors hug scaled cards) ──
    const getEdgePath = (sourceId: string, targetId: string) => {
      const src = nodePositions.get(sourceId);
      const tgt = nodePositions.get(targetId);
      if (!src || !tgt) return null;
      const ss = sizeFor(sourceId);
      const ts = sizeFor(targetId);
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) return null;
      const ux = dx / dist;
      const uy = dy / dist;
      const startX = src.x + ux * (ss.w / 2 + 2);
      const startY = src.y + uy * (ss.h / 2 + 2);
      const endX = tgt.x - ux * (ts.w / 2 + 9);
      const endY = tgt.y - uy * (ts.h / 2 + 9);
      const isNearHorizontal = Math.abs(uy) < 0.4;
      const curveAmt = isNearHorizontal
        ? Math.min(dist * 0.32, 60)
        : Math.min(dist * 0.18, 32);
      const mx = (startX + endX) / 2 - uy * curveAmt;
      const my = (startY + endY) / 2 + ux * curveAmt;
      return { path: `M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`, lx: mx, ly: my };
    };

    const selectSearchMatch = (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setActiveDetailsTab("overview");
      setNodeSearch("");
    };

    // ── filtered document list ──
    const filteredDocs = useMemo(() => {
      const q = docSearch.trim().toLowerCase();
      return documents.filter((d) => !q || d.filename.toLowerCase().includes(q));
    }, [documents, docSearch]);

    // ── canvas handlers ──
    const svgRef = useRef<SVGSVGElement>(null);

    // Convert a client point to SVG viewBox coordinates.
    const clientToSvg = (clientX: number, clientY: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: CX, y: CY };
      return {
        x: ((clientX - rect.left) / rect.width) * SVG_W,
        y: ((clientY - rect.top) / rect.height) * SVG_H,
      };
    };

    // Zoom while keeping the point under the cursor anchored (smooth zoom UX).
    const handleWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z * factor).toFixed(3))));
        const p = clientToSvg(e.clientX, e.clientY);
        setOffset((o) => ({
          x: p.x - (p.x - o.x) * (next / z),
          y: p.y - (p.y - o.y) * (next / z),
        }));
        return next;
      });
    };

    const beginPan: React.MouseEventHandler<SVGSVGElement> = (e) => {
      if ((e.target as SVGElement).closest("[data-node='true']")) return;
      setIsPanning(true);
      didPanRef.current = false;
      panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    };

    const onPanMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
      if (!isPanning || !panStart.current) return;
      const ddx = e.clientX - panStart.current.x;
      const ddy = e.clientY - panStart.current.y;
      if (Math.abs(ddx) + Math.abs(ddy) > 3) didPanRef.current = true;
      setOffset({
        x: panStart.current.ox + ddx,
        y: panStart.current.oy + ddy,
      });
    };

    const endPan = () => {
      setIsPanning(false);
      panStart.current = null;
    };

    // Clicking empty canvas (without dragging) clears focus back to the summary.
    const handleCanvasClick: React.MouseEventHandler<SVGSVGElement> = (e) => {
      if ((e.target as SVGElement).closest("[data-node='true']")) return;
      if (didPanRef.current) return;
      setSelectedNodeId(null);
    };

    const zoomBy = (factor: number) => {
      setZoom((z) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z * factor).toFixed(3))));
        setOffset((o) => ({
          x: CX - (CX - o.x) * (next / z),
          y: CY - (CY - o.y) * (next / z),
        }));
        return next;
      });
    };

    // Frame the entire graph.
    const fitGraph = useCallback(() => {
      setZoom(suggestedZoom);
      setOffset({
        x: CX - suggestedZoom * layoutCenter.x,
        y: CY - suggestedZoom * layoutCenter.y,
      });
    }, [suggestedZoom, layoutCenter]);

    // Center the currently selected node at a comfortable zoom.
    const centerSelected = useCallback(() => {
      if (!selectedNodeId) return fitGraph();
      const pos = nodePositions.get(selectedNodeId);
      if (!pos) return;
      const z = Math.max(0.85, Math.min(MAX_ZOOM, zoom));
      setZoom(z);
      setOffset({ x: CX - z * pos.x, y: CY - z * pos.y });
    }, [selectedNodeId, nodePositions, zoom, fitGraph]);

    const resetView = fitGraph;

    const toggleLabels = () =>
      setLabelMode((m) => (m === "off" ? "auto" : "off"));

    // ── level-of-detail flags (progressive disclosure on zoom) ──
    const showSubtitles = labelMode === "off" ? false : labelMode === "on" ? true : zoom >= ZOOM_SHOW_SUBTITLE;
    const showAllEdgeLabels = labelMode === "off" ? false : labelMode === "on" ? true : zoom >= ZOOM_SHOW_EDGE_LABELS;

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

    // ── minimap geometry ──
    const MM_W = 156;
    const MM_H = 104;
    const MM_PAD = 10;
    const graphBounds = useMemo(() => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of nodePositions.values()) {
        minX = Math.min(minX, p.x - NODE_W / 2);
        minY = Math.min(minY, p.y - NODE_H / 2);
        maxX = Math.max(maxX, p.x + NODE_W / 2);
        maxY = Math.max(maxY, p.y + NODE_H / 2);
      }
      if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: SVG_W, maxY: SVG_H };
      return { minX, minY, maxX, maxY };
    }, [nodePositions]);

    const minimap = useMemo(() => {
      const bw = Math.max(graphBounds.maxX - graphBounds.minX, 1);
      const bh = Math.max(graphBounds.maxY - graphBounds.minY, 1);
      const innerW = MM_W - MM_PAD * 2;
      const innerH = MM_H - MM_PAD * 2;
      const scale = Math.min(innerW / bw, innerH / bh);
      const tx = MM_PAD + (innerW - bw * scale) / 2 - graphBounds.minX * scale;
      const ty = MM_PAD + (innerH - bh * scale) / 2 - graphBounds.minY * scale;
      const toMM = (x: number, y: number) => ({ x: x * scale + tx, y: y * scale + ty });
      // Current viewport in world coords → minimap rect
      const vx0 = (0 - offset.x) / zoom;
      const vy0 = (0 - offset.y) / zoom;
      const vx1 = (SVG_W - offset.x) / zoom;
      const vy1 = (SVG_H - offset.y) / zoom;
      const a = toMM(vx0, vy0);
      const b = toMM(vx1, vy1);
      return { scale, toMM, view: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } };
    }, [graphBounds, offset, zoom]);

    // Click minimap → recenter viewport on that world point.
    const handleMinimapClick: React.MouseEventHandler<SVGSVGElement> = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * MM_W;
      const my = ((e.clientY - rect.top) / rect.height) * MM_H;
      const bw = Math.max(graphBounds.maxX - graphBounds.minX, 1);
      const bh = Math.max(graphBounds.maxY - graphBounds.minY, 1);
      const innerW = MM_W - MM_PAD * 2;
      const innerH = MM_H - MM_PAD * 2;
      const scale = Math.min(innerW / bw, innerH / bh);
      const tx = MM_PAD + (innerW - bw * scale) / 2 - graphBounds.minX * scale;
      const ty = MM_PAD + (innerH - bh * scale) / 2 - graphBounds.minY * scale;
      const worldX = (mx - tx) / scale;
      const worldY = (my - ty) / scale;
      setOffset({ x: CX - zoom * worldX, y: CY - zoom * worldY });
    };

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
            {/* Node search */}
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70 pointer-events-none" />
              <input
                className="h-8 pl-8 pr-3 text-[12px] rounded-md border border-border/50 bg-[#0a1525] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 w-44 transition-colors"
                placeholder="Search nodes…"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchMatches[0]) {
                    e.preventDefault();
                    selectSearchMatch(searchMatches[0].id);
                  } else if (e.key === "Escape") {
                    setNodeSearch("");
                  }
                }}
              />
              {searchQuery && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto rounded-md border border-border/60 bg-[#0a1525] shadow-lg">
                  {searchMatches.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-muted-foreground">No matching nodes</p>
                  ) : (
                    searchMatches.slice(0, 12).map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/30 transition-colors ${
                          node.id === selectedNodeId ? "bg-primary/15" : ""
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSearchMatch(node.id)}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: getTypeColor(node.type).stroke }}
                        />
                        <span className="text-[12px] text-foreground truncate flex-1">{node.label}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{node.type}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="flex-1" />

            {/* Compact icon controls */}
            <div className="flex items-center gap-1">
              <button
                className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={fitGraph}
                title="Fit graph"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-40"
                onClick={centerSelected}
                disabled={!selectedNodeId}
                title="Center selected node"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-border/40 mx-0.5" />

              <button
                className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => zoomBy(1 - ZOOM_STEP)}
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-muted-foreground min-w-[36px] text-center tabular-nums select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => zoomBy(1 + ZOOM_STEP)}
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-border/40 mx-0.5" />

              <button
                className={`h-7 w-7 flex items-center justify-center rounded-md border transition-colors ${
                  labelMode === "off"
                    ? "border-primary/50 text-primary bg-primary/10"
                    : "border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
                onClick={toggleLabels}
                title={labelMode === "off" ? "Show labels" : "Hide labels"}
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
              <button
                className="h-7 w-7 flex items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
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
                ref={svgRef}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                className={`w-full h-full ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
                onWheel={handleWheel}
                onMouseDown={beginPan}
                onMouseMove={onPanMove}
                onMouseUp={endPan}
                onMouseLeave={endPan}
                onClick={handleCanvasClick}
              >
                <defs>
                  <marker id="kg-arrow-out" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                    <path d="M0,0.5 L7.5,3.5 L0,6.5" fill="none" stroke="#7C87F0" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                  <marker id="kg-arrow-in" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
                    <path d="M0,0.5 L7.5,3.5 L0,6.5" fill="none" stroke="#57C0F5" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                  {/* Per-type card gradients */}
                  {(Object.entries(TYPE_COLORS) as [KGNodeType, TypePalette][]).map(
                    ([t, c]) => (
                      <linearGradient key={t} id={`kg-grad-${t}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={c.gradFrom} />
                        <stop offset="100%" stopColor={c.gradTo} />
                      </linearGradient>
                    )
                  )}
                  <linearGradient id="kg-grad-muted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#151d2a" />
                    <stop offset="100%" stopColor="#0d141f" />
                  </linearGradient>
                  <filter id="kg-glow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3.5" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="kg-shadow" x="-20%" y="-20%" width="140%" height="150%">
                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
                  </filter>
                  <pattern id="kg-dots" width="28" height="28" patternUnits="userSpaceOnUse">
                    <circle cx="2" cy="2" r="1" fill="#17223a" />
                  </pattern>
                </defs>

                <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
                  {/* Spatial reference grid (pans with the graph) */}
                  <rect x={-3000} y={-3000} width={6000} height={6000} fill="url(#kg-dots)" pointerEvents="none" />
                  {/* Edges — render every relation for this document */}
                  {graphData.edges.map((edge) => {
                    const result = getEdgePath(edge.source, edge.target);
                    if (!result) return null;

                    const touchesFocus =
                      !!focusId &&
                      (edge.source === focusId || edge.target === focusId);
                    const isOutgoing = edge.source === focusId;
                    const searchActive = matchingNodeIds != null;
                    const searchDim =
                      searchActive &&
                      !matchingNodeIds!.has(edge.source) &&
                      !matchingNodeIds!.has(edge.target);

                    // Focus mode: highlight edges on the focused node, fade the rest.
                    const groupOpacity = searchDim
                      ? 0.06
                      : touchesFocus
                        ? 1
                        : focusId
                          ? 0.16
                          : 0.5;

                    const strokeColor = touchesFocus
                      ? isOutgoing
                        ? "#7C87F0"
                        : "#57C0F5"
                      : "#3a4a63";
                    const markerId = touchesFocus
                      ? isOutgoing
                        ? "url(#kg-arrow-out)"
                        : "url(#kg-arrow-in)"
                      : undefined;

                    const rawLabel = edge.label ?? "";
                    const showLabel =
                      rawLabel.length > 0 &&
                      !searchDim &&
                      (touchesFocus || showAllEdgeLabels);
                    const displayLabel =
                      rawLabel.length > 20 ? `${rawLabel.slice(0, 19)}…` : rawLabel;
                    const labelW = displayLabel.length * 5.6 + 12;

                    return (
                      <g
                        key={edge.id}
                        opacity={groupOpacity}
                        style={{ transition: "opacity 220ms ease" }}
                      >
                        {touchesFocus && (
                          <path
                            d={result.path}
                            fill="none"
                            stroke={strokeColor}
                            strokeOpacity="0.14"
                            strokeWidth="5"
                          />
                        )}
                        <path
                          d={result.path}
                          fill="none"
                          stroke={strokeColor}
                          strokeOpacity={touchesFocus ? 0.9 : 0.55}
                          strokeWidth={touchesFocus ? 1.4 : 0.9}
                          strokeLinecap="round"
                          markerEnd={markerId}
                          strokeDasharray={touchesFocus ? "5 6" : undefined}
                        >
                          {touchesFocus && (
                            <animate
                              attributeName="stroke-dashoffset"
                              from="22"
                              to="0"
                              dur="1.1s"
                              repeatCount="indefinite"
                            />
                          )}
                        </path>
                        {showLabel && (
                          <g>
                            <title>{rawLabel}</title>
                            <rect
                              x={result.lx - labelW / 2}
                              y={result.ly - 8}
                              width={labelW}
                              height={14}
                              rx={5}
                              fill="#0a1220"
                              fillOpacity="0.92"
                              stroke={strokeColor}
                              strokeOpacity="0.3"
                              strokeWidth="0.8"
                            />
                            <text
                              x={result.lx}
                              y={result.ly + 1}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="8.5"
                              fill={touchesFocus ? strokeColor : "#8595ab"}
                              fillOpacity="0.95"
                              className="select-none"
                            >
                              {displayLabel}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Nodes — all entities for this document */}
                  {graphData.nodes.map((node) => {
                    const pos = nodePositions.get(node.id);
                    if (!pos) return null;

                    const isSelected = node.id === selectedNodeId;
                    const isNeighbor = neighborIds.has(node.id);
                    const isHovered = hoveredNodeId === node.id;
                    const searchActive = matchingNodeIds != null;
                    const matchesSearch = !searchActive || matchingNodeIds!.has(node.id);

                    // Focus/hover fade (Neo4j-Bloom style).
                    const inFocusSet =
                      !focusId ||
                      node.id === focusId ||
                      focusNeighborIds.has(node.id);
                    const opacity = searchActive
                      ? matchesSearch
                        ? 1
                        : 0.12
                      : inFocusSet
                        ? 1
                        : 0.3;

                    const size = sizeFor(node.id);
                    const w = size.w;
                    const h = size.h;
                    const nx = pos.x - w / 2;
                    const ny = pos.y - h / 2;

                    const palette = getTypeColor(node.type);
                    const accent = palette.stroke;
                    // Faded nodes drop to a muted fill so the focus set pops.
                    const bright = inFocusSet || isHovered || matchesSearch;
                    const fillUrl = bright
                      ? `url(#kg-grad-${(TYPE_COLORS[node.type as KGNodeType] ? node.type : "Other") as string})`
                      : "url(#kg-grad-muted)";
                    const borderColor = bright ? accent : MUTED_STROKE;
                    const strokeWidth = isSelected ? 2.2 : isNeighbor ? 1.5 : 1.1;

                    // Card geometry
                    const iconD = Math.min(h - 14, 22);
                    const iconCx = nx + 11 + iconD / 2;
                    const iconCy = pos.y;
                    const textX = nx + 11 + iconD + 9;
                    const availW = nx + w - 10 - textX;
                    const titleSize = isSelected ? 12 : 10.5;
                    const maxChars = Math.max(6, Math.floor(availW / (titleSize * 0.56)));
                    const allowTwoLines = isSelected || isHovered;
                    const titleLines = wrapLabel(
                      node.label,
                      maxChars,
                      allowTwoLines ? 2 : 1
                    );
                    const twoLines = titleLines.length > 1;
                    const showSub = showSubtitles && !twoLines;

                    const textColor = bright ? palette.text : "#5c6b80";
                    const subColor = bright ? palette.label : "#3c4759";

                    return (
                      <g
                        key={node.id}
                        data-node="true"
                        onClick={() => {
                          setSelectedNodeId(node.id);
                          setActiveDetailsTab("overview");
                        }}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() =>
                          setHoveredNodeId((id) => (id === node.id ? null : id))
                        }
                        style={{
                          cursor: "pointer",
                          opacity,
                          transformBox: "fill-box",
                          transformOrigin: "center",
                          transform: isHovered ? "scale(1.06)" : "scale(1)",
                          transition:
                            "transform 160ms cubic-bezier(0.2,0.7,0.3,1), opacity 220ms ease",
                        }}
                        filter={
                          isSelected || isHovered
                            ? "url(#kg-glow)"
                            : "url(#kg-shadow)"
                        }
                      >
                        <title>{`${node.label} — ${node.type}`}</title>

                        {/* Animated selection ring */}
                        {isSelected && (
                          <rect
                            x={nx - 3.5}
                            y={ny - 3.5}
                            width={w + 7}
                            height={h + 7}
                            rx={NODE_R + 3}
                            fill="none"
                            stroke={accent}
                            strokeWidth="1.4"
                          >
                            <animate
                              attributeName="stroke-opacity"
                              values="0.55;0.12;0.55"
                              dur="2.6s"
                              repeatCount="indefinite"
                            />
                          </rect>
                        )}

                        {/* Card body */}
                        <rect
                          x={nx}
                          y={ny}
                          width={w}
                          height={h}
                          rx={NODE_R}
                          fill={fillUrl}
                          stroke={borderColor}
                          strokeWidth={strokeWidth}
                          strokeOpacity={bright ? (isSelected ? 1 : 0.85) : 0.7}
                        />
                        {/* Accent side rail */}
                        {bright && (
                          <rect
                            x={nx}
                            y={ny + NODE_R / 2}
                            width={3}
                            height={h - NODE_R}
                            rx={1.5}
                            fill={accent}
                            fillOpacity={isSelected ? 0.95 : 0.7}
                          />
                        )}

                        {/* Type icon dot */}
                        <circle
                          cx={iconCx}
                          cy={iconCy}
                          r={iconD / 2}
                          fill={accent}
                          fillOpacity={bright ? 0.92 : 0.5}
                        />
                        <text
                          x={iconCx}
                          y={iconCy}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fontSize={iconD * 0.56}
                          fontWeight="700"
                          fill="#0b1220"
                          className="select-none"
                        >
                          {node.type.charAt(0).toUpperCase()}
                        </text>

                        {/* Title (1–2 smart-wrapped lines) */}
                        <text
                          x={textX}
                          fontSize={titleSize}
                          fontWeight={isSelected ? 700 : 600}
                          fill={textColor}
                          className="select-none"
                        >
                          {twoLines ? (
                            <>
                              <tspan x={textX} y={pos.y - 6} dominantBaseline="middle">
                                {titleLines[0]}
                              </tspan>
                              <tspan x={textX} y={pos.y + 6} dominantBaseline="middle">
                                {titleLines[1]}
                              </tspan>
                            </>
                          ) : (
                            <tspan
                              x={textX}
                              y={showSub ? pos.y - 6 : pos.y}
                              dominantBaseline="middle"
                            >
                              {titleLines[0]}
                            </tspan>
                          )}
                        </text>

                        {/* Subtitle (type) — hidden when zoomed out or wrapped */}
                        {showSub && (
                          <text
                            x={textX}
                            y={pos.y + 8}
                            fontSize="8.5"
                            fontWeight="500"
                            fill={subColor}
                            dominantBaseline="middle"
                            className="select-none"
                          >
                            {node.type}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            {/* Entity Type Legend */}
            {graphData && graphData.nodes.length > 0 && (
              <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-x-4 gap-y-1 max-w-[calc(100%-200px)]">
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

            {/* Minimap */}
            {graphData && graphData.nodes.length > 1 && (
              <div className="absolute bottom-3 right-3 rounded-lg border border-border/50 bg-[#070f1c]/85 backdrop-blur-sm shadow-lg overflow-hidden">
                <svg
                  width={MM_W}
                  height={MM_H}
                  viewBox={`0 0 ${MM_W} ${MM_H}`}
                  className="cursor-pointer block"
                  onClick={handleMinimapClick}
                >
                  <rect x={0} y={0} width={MM_W} height={MM_H} fill="transparent" />
                  {graphData.edges.map((edge) => {
                    const s = nodePositions.get(edge.source);
                    const t = nodePositions.get(edge.target);
                    if (!s || !t) return null;
                    const a = minimap.toMM(s.x, s.y);
                    const b = minimap.toMM(t.x, t.y);
                    return (
                      <line
                        key={edge.id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="#26374f"
                        strokeWidth="0.5"
                        strokeOpacity="0.6"
                      />
                    );
                  })}
                  {graphData.nodes.map((node) => {
                    const p = nodePositions.get(node.id);
                    if (!p) return null;
                    const m = minimap.toMM(p.x, p.y);
                    const isSel = node.id === selectedNodeId;
                    return (
                      <circle
                        key={node.id}
                        cx={m.x}
                        cy={m.y}
                        r={isSel ? 2.6 : 1.6}
                        fill={getTypeColor(node.type).stroke}
                        fillOpacity={isSel ? 1 : 0.75}
                      />
                    );
                  })}
                  {/* Viewport rectangle */}
                  <rect
                    x={minimap.view.x}
                    y={minimap.view.y}
                    width={minimap.view.w}
                    height={minimap.view.h}
                    fill="#5B9DF0"
                    fillOpacity="0.1"
                    stroke="#5B9DF0"
                    strokeOpacity="0.7"
                    strokeWidth="1"
                    rx={2}
                    pointerEvents="none"
                  />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════ RIGHT: Details Panel (fixed width — never resizes the canvas) ══════════════ */}
        <div
          className="shrink-0 flex flex-col border-l border-border bg-card overflow-hidden"
          style={{ width: 300, minWidth: 300, maxWidth: 300 }}
        >
          {selectedNode ? (
            /* ── Node selected: fixed header + tabs + scrollable body + pinned footer ── */
            <>
              {/* Fixed-height header */}
              <div className="px-4 pt-4 pb-3 shrink-0 h-[76px] overflow-hidden">
                <div className="flex items-start gap-3 h-full">
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
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p
                      className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 break-words"
                      title={selectedNode.label}
                    >
                      {selectedNode.label || "—"}
                    </p>
                    <span
                      className="inline-flex items-center max-w-full truncate px-1.5 py-px rounded text-[11px] font-medium mt-1"
                      style={{
                        background: getTypeColor(selectedNode.type).centerFill,
                        color: getTypeColor(selectedNode.type).stroke,
                        border: `1px solid ${getTypeColor(selectedNode.type).stroke}35`,
                      }}
                    >
                      {selectedNode.type || "Other"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fixed tabs */}
              <div className="flex border-b border-border/60 shrink-0 h-9">
                {(["overview", "properties"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveDetailsTab(tab)}
                    className={`flex-1 text-[13px] font-medium transition-colors duration-150 border-b-2 -mb-px ${
                      activeDetailsTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab === "overview" ? "Overview" : "Properties"}
                  </button>
                ))}
              </div>

              {/* Scrollable content — only the active tab is mounted (avoids stacked-panel bugs) */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-3">
                {activeDetailsTab === "overview" ? (
                  <div className="flex flex-col gap-4">
                    {/* Relationship count cards */}
                    <div className="shrink-0">
                      <p className="text-[13px] font-semibold text-foreground mb-2">Direct Relationships</p>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0 rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                          <p className="text-[18px] font-bold text-[#818CF8] leading-none tabular-nums">
                            {relatedEdges.outgoing.length}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">Outgoing</p>
                        </div>
                        <div className="flex-1 min-w-0 rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                          <p className="text-[18px] font-bold text-[#38BDF8] leading-none tabular-nums">
                            {relatedEdges.incoming.length}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">Incoming</p>
                        </div>
                      </div>
                    </div>

                    {/* Outgoing */}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground mb-2 flex items-center gap-1.5 min-w-0">
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#818CF8] shrink-0" />
                        <span className="shrink-0">Outgoing</span>
                        <span className="text-[12px] text-muted-foreground font-normal truncate">
                          ({selectedNode.label} → Other)
                        </span>
                      </p>
                      {relatedEdges.outgoing.length > 0 ? (
                        <div className="space-y-0.5">
                          {relatedEdges.outgoing.map((edge) => {
                            const targetNode = graphData?.nodes.find((n) => n.id === edge.target);
                            return (
                              <button
                                key={edge.id}
                                className="w-full h-8 flex items-center gap-2 px-2.5 rounded-md hover:bg-muted/25 transition-colors group text-left min-w-0"
                                onClick={() => { setSelectedNodeId(edge.target); setActiveDetailsTab("overview"); }}
                              >
                                <div
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: getTypeColor(targetNode?.type ?? "Other").stroke }}
                                />
                                <span className="text-[13px] text-foreground truncate flex-1 min-w-0">
                                  {targetNode?.label ?? edge.target}
                                </span>
                                <span
                                  className="text-[11px] text-muted-foreground/70 shrink-0 font-mono max-w-[72px] truncate"
                                  title={edge.label}
                                >
                                  {edge.label || "—"}
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[12px] text-muted-foreground px-2.5 py-2">No relationships</p>
                      )}
                    </div>

                    {/* Incoming */}
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground mb-2 flex items-center gap-1.5 min-w-0">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
                        <span className="shrink-0">Incoming</span>
                        <span className="text-[12px] text-muted-foreground font-normal truncate">
                          (Other → {selectedNode.label})
                        </span>
                      </p>
                      {relatedEdges.incoming.length > 0 ? (
                        <div className="space-y-0.5">
                          {relatedEdges.incoming.map((edge) => {
                            const sourceNode = graphData?.nodes.find((n) => n.id === edge.source);
                            return (
                              <button
                                key={edge.id}
                                className="w-full h-8 flex items-center gap-2 px-2.5 rounded-md hover:bg-muted/25 transition-colors group text-left min-w-0"
                                onClick={() => { setSelectedNodeId(edge.source); setActiveDetailsTab("overview"); }}
                              >
                                <div
                                  className="w-1.5 h-1.5 rounded-full shrink-0"
                                  style={{ background: getTypeColor(sourceNode?.type ?? "Other").stroke }}
                                />
                                <span className="text-[13px] text-foreground truncate flex-1 min-w-0">
                                  {sourceNode?.label ?? edge.source}
                                </span>
                                <span
                                  className="text-[11px] text-muted-foreground/70 shrink-0 font-mono max-w-[72px] truncate"
                                  title={edge.label}
                                >
                                  {edge.label || "—"}
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[12px] text-muted-foreground px-2.5 py-2">No relationships</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: "Label", value: selectedNode.label || "—" },
                      { label: "Type", value: selectedNode.type || "—" },
                      { label: "Node ID", value: selectedNode.id || "—" },
                      { label: "Outgoing", value: String(relatedEdges.outgoing.length) },
                      { label: "Incoming", value: String(relatedEdges.incoming.length) },
                      { label: "Total Relations", value: String(relatedEdges.all.length) },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
                        <p className="text-[13px] text-foreground truncate" title={value}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pinned footer */}
              <div className="px-3 py-2.5 border-t border-border/60 shrink-0 bg-card">
                <button
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md border border-border/50 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
                  onClick={() => setSummaryOpen(true)}
                >
                  View Graph Summary
                </button>
              </div>
            </>
          ) : (
            /* ── No node selected: graph/document summary (same fixed panel width) ── */
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
              {!selectedDoc ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-4 text-center">
                  <BookOpen className="w-8 h-8 opacity-30 mb-2" />
                  <p className="text-[13px]">Select a document from the sidebar.</p>
                </div>
              ) : (
                <div className="px-4 py-3 flex flex-col gap-4 min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-[13px] font-semibold text-foreground leading-tight truncate" title={selectedDoc.filename}>
                        {selectedDoc.filename}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Knowledge Graph</p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground mb-2">Document Info</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "Upload Date", value: formatDate(selectedDoc.created_at) },
                        { label: "Page Count", value: `${selectedDoc.page_count} ${selectedDoc.page_count === 1 ? "page" : "pages"}` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between gap-2 py-1 border-b border-border/30 last:border-0 min-w-0">
                          <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
                          <span className="text-[13px] text-foreground font-medium truncate">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {graphData ? (
                    <>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground mb-2">Graph Statistics</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                            <p className="text-[18px] font-bold text-primary leading-none tabular-nums">{graphData.stats.node_count}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Nodes</p>
                          </div>
                          <div className="rounded-md bg-muted/15 border border-border/50 py-2.5 text-center">
                            <p className="text-[18px] font-bold text-accent leading-none tabular-nums">{graphData.stats.edge_count}</p>
                            <p className="text-[11px] text-muted-foreground mt-1">Relations</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[13px] font-semibold text-foreground mb-2">Entity Types</p>
                        {Object.keys(typeCounts).length > 0 ? (
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
                                    <div className="flex items-center justify-between mb-1 gap-2 min-w-0">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                        <span className="text-[13px] text-foreground truncate">{type}</span>
                                      </div>
                                      <span className="text-[13px] text-muted-foreground tabular-nums shrink-0">{count}</span>
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
                        ) : (
                          <p className="text-[12px] text-muted-foreground">Not Available</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div>
                      <p className="text-[13px] font-semibold text-foreground mb-2">Graph Statistics</p>
                      <p className="text-[12px] text-muted-foreground">{isLoadingGraph ? "Loading…" : "Not Available"}</p>
                    </div>
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

        {/* ══════════════ Graph Summary Dialog ══════════════ */}
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Graph Summary</DialogTitle>
              <DialogDescription>
                {selectedDoc
                  ? `Overview of entities and relationships in "${selectedDoc.filename}".`
                  : "Overview of the selected knowledge graph."}
              </DialogDescription>
            </DialogHeader>
            {selectedDoc && (
              <div className="flex flex-col gap-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground leading-tight truncate" title={selectedDoc.filename}>
                      {selectedDoc.filename}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {selectedDoc.page_count} {selectedDoc.page_count === 1 ? "page" : "pages"} · {formatDate(selectedDoc.created_at)}
                    </p>
                  </div>
                </div>

                {graphData && (
                  <>
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

                    {Object.keys(typeCounts).length > 0 && (
                      <div>
                        <p className="text-[13px] font-semibold text-foreground mb-2">Entity Types</p>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {(Object.entries(typeCounts) as [string, number][])
                            .sort(([, a], [, b]) => b - a)
                            .map(([type, count]) => {
                              const pct =
                                graphData.stats.node_count > 0
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
              </div>
            )}
          </DialogContent>
        </Dialog>

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
