import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  Clock,
  Database,
  Filter,
  GitFork,
  KeyRound,
  LayoutGrid,
  Link2,
  RotateCcw,
  Search,
  Shuffle,
  Star,
  Tag,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { OntologyVersionPayload } from "../../../services/api";

interface OntologyViewerProps {
  ontology: OntologyVersionPayload;
}

type Direction = "both" | "outgoing" | "incoming";
type ActiveTab = "overview" | "properties";
type GlobalTab = "graph" | "business";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

const SVG_W = 900;
const SVG_H = 500;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const CENTER_W = 180;
const CENTER_H = 46;
const NODE_W = 152;
const NODE_H = 38;
const NODE_R = 8;

// Colour palette by node type
const TYPE_COLORS: Record<string, { fill: string; stroke: string; accent: string }> = {
  Entity:     { fill: "#1e1b4b", stroke: "#818CF8", accent: "#a5b4fc" },
  Class:      { fill: "#1e1b4b", stroke: "#818CF8", accent: "#a5b4fc" },
  Attribute:  { fill: "#0c1a2e", stroke: "#38BDF8", accent: "#7dd3fc" },
  Property:   { fill: "#0c1a2e", stroke: "#38BDF8", accent: "#7dd3fc" },
  Concept:    { fill: "#14291a", stroke: "#34D399", accent: "#6ee7b7" },
  Relation:   { fill: "#1a1108", stroke: "#FBBF24", accent: "#fde68a" },
  default:    { fill: "#0f172a", stroke: "#475569", accent: "#94a3b8" },
};

function typeColors(type: string) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default;
}

export function OntologyViewer({ ontology }: OntologyViewerProps) {
  const { graph, version_label, status } = ontology;
  const nodes = graph.nodes;
  const edges = graph.edges;

  // Pull business context from the raw ontology JSON
  const rawOntology = ontology.ontology ?? {};
  const metrics: Array<{ name: string; description?: string; formula?: string }> =
    Array.isArray(rawOntology.metrics) ? rawOntology.metrics : [];
  const rules: Record<string, any> = rawOntology.rules && typeof rawOntology.rules === "object" ? rawOntology.rules : {};
  const aliases: Array<{ term: string; maps_to: string }> =
    Array.isArray(rawOntology.aliases) ? rawOntology.aliases : [];

  const [globalTab, setGlobalTab] = useState<GlobalTab>("graph");

  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("both");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? nodes[0],
    [nodes, selectedNodeId]
  );

  const relatedEdges = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [], incoming: [], all: [] };
    const outgoing = edges.filter((e) => e.source === selectedNodeId);
    const incoming = edges.filter((e) => e.target === selectedNodeId);
    return { outgoing, incoming, all: [...outgoing, ...incoming] };
  }, [selectedNodeId, edges]);

  const visibleEdges = useMemo(() => {
    if (direction === "outgoing") return relatedEdges.outgoing;
    if (direction === "incoming") return relatedEdges.incoming;
    return relatedEdges.all;
  }, [direction, relatedEdges]);

  const connectedIds = useMemo(
    () =>
      new Set(
        visibleEdges.flatMap((e) => [e.source, e.target]).filter((id) => id !== selectedNodeId)
      ),
    [visibleEdges, selectedNodeId]
  );

  const { nodePositions, suggestedZoom } = useMemo(() => {
    const neighborNodes = nodes.filter(
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
  }, [selectedNodeId, nodes, connectedIds]);

  const prevNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    if (prevNodeIdRef.current !== selectedNodeId) {
      prevNodeIdRef.current = selectedNodeId;
      setOffset({ x: CX * (1 - suggestedZoom), y: CY * (1 - suggestedZoom) });
      setZoom(suggestedZoom);
    }
  }, [selectedNodeId, suggestedZoom]);

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
    const endX   = tgt.x - ux * (tgt.w / 2 + 9);
    const endY   = tgt.y - uy * (tgt.h / 2 + 9);
    const curveAmt = Math.min(dist * 0.18, 30);
    const mx = (startX + endX) / 2 - uy * curveAmt;
    const my = (startY + endY) / 2 + ux * curveAmt;
    const lx = 0.25 * startX + 0.5 * mx + 0.25 * endX;
    const ly = 0.25 * startY + 0.5 * my + 0.25 * endY;
    return { path: `M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`, lx, ly };
  };

  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return nodes.filter(
      (n) => !q || n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q)
    );
  }, [nodes, search]);

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

  const endPan = () => { setIsPanning(false); panStart.current = null; };

  const resetView = () => {
    setZoom(suggestedZoom);
    setOffset({ x: CX * (1 - suggestedZoom), y: CY * (1 - suggestedZoom) });
  };

  const totalNodes = nodes.length;
  const totalEdges = edges.length;

  // A rule key counts only if it has a meaningful (non-empty) value
  const hasRealValue = (v: unknown): boolean => {
    if (v === null || v === undefined || v === false || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return true;
  };
  const meaningfulRuleKeys = Object.keys(rules).filter((k) => hasRealValue(rules[k]));
  const businessContextCount = metrics.length + meaningfulRuleKeys.length + aliases.length;
  const hasBusinessContext = businessContextCount > 0;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card">

      {/* Global tab bar */}
      <div className="flex items-center border-b border-border shrink-0 bg-card px-2 gap-1 pt-1">
        <button
          onClick={() => setGlobalTab("graph")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t border-b-2 transition-colors ${
            globalTab === "graph"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <GitFork className="w-3.5 h-3.5" />
          Schema Graph
        </button>
        <button
          onClick={() => setGlobalTab("business")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-t border-b-2 transition-colors ${
            globalTab === "business"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Business Context
          {hasBusinessContext && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[9px] font-semibold">
              {businessContextCount}
            </span>
          )}
        </button>
      </div>

      {/* Business Context panel */}
      {globalTab === "business" && (
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
          {!hasBusinessContext && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <BookOpen className="w-8 h-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No business context yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Use the Enrich Datasource chat to define metrics, granularity, aliases, and rules.
              </p>
            </div>
          )}

          {/* Metrics */}
          {metrics.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                Business Metrics ({metrics.length})
              </p>
              <div className="space-y-2">
                {metrics.map((m, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-semibold text-foreground mb-0.5">{m.name}</p>
                    {m.description && (
                      <p className="text-[11px] text-muted-foreground mb-1.5">{m.description}</p>
                    )}
                    {m.formula && (
                      <code className="block text-[11px] bg-[#0a0f1a] border border-border/40 rounded px-2 py-1.5 text-emerald-400 font-mono break-all">
                        {m.formula}
                      </code>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rules */}
          {Object.keys(rules).length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
                <Filter className="w-3.5 h-3.5 text-sky-400" />
                Business Rules
              </p>
              <div className="rounded-md border border-border/60 bg-muted/20 divide-y divide-border/40">
                {rules.default_time_granularity && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="text-xs text-muted-foreground">Default Granularity</span>
                    </div>
                    <span className="text-xs font-semibold text-sky-300 capitalize px-2 py-0.5 bg-sky-400/10 border border-sky-400/20 rounded">
                      {rules.default_time_granularity}
                    </span>
                  </div>
                )}
                {rules.default_time_dimension && (
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span className="text-xs text-muted-foreground">Default Date Column</span>
                    </div>
                    <code className="text-[11px] font-mono text-sky-300 px-2 py-0.5 bg-sky-400/10 border border-sky-400/20 rounded">
                      {rules.default_time_dimension}
                    </code>
                  </div>
                )}
                {rules.status_success_values && Array.isArray(rules.status_success_values) && rules.status_success_values.length > 0 && (
                  <div className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">Success Status Values</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rules.status_success_values.map((v: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20 text-emerald-300">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {rules.status_failure_values && Array.isArray(rules.status_failure_values) && rules.status_failure_values.length > 0 && (
                  <div className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">Failure Status Values</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rules.status_failure_values.map((v: string, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 border border-red-400/20 text-red-300">
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {rules.default_filters && typeof rules.default_filters === "object" && Object.keys(rules.default_filters).length > 0 && (
                  <div className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">Default Filters</span>
                    <div className="mt-1 space-y-0.5">
                      {Object.entries(rules.default_filters).map(([col, val]) => (
                        <div key={col} className="flex gap-1.5 text-[11px]">
                          <code className="text-sky-300 font-mono">{col}</code>
                          <span className="text-muted-foreground">=</span>
                          <code className="text-amber-300 font-mono">{String(val)}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Aliases */}
          {aliases.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
                <Tag className="w-3.5 h-3.5 text-violet-400" />
                Business Term Aliases ({aliases.length})
              </p>
              <div className="rounded-md border border-border/60 bg-muted/20 divide-y divide-border/40">
                {aliases.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs font-medium text-violet-300">"{a.term}"</span>
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <code className="text-[11px] font-mono text-foreground">{a.maps_to}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graph view */}
      {globalTab === "graph" && (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ──────────── LEFT: Entity List ──────────── */}
      <div className="w-52 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <span className="text-sm font-medium text-foreground">Entities</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
            {totalNodes} Total
          </span>
        </div>

        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
              placeholder="Search entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2">
          {filteredNodes.map((node) => {
            const isSelected = node.id === selectedNodeId;
            const isConnected = connectedIds.has(node.id);
            const colors = typeColors(node.type);
            return (
              <button
                key={node.id}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors mb-0.5 ${
                  isSelected
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "hover:bg-muted/50 text-foreground"
                }`}
                onClick={() => { setSelectedNodeId(node.id); setActiveTab("overview"); }}
              >
                <div
                  className="w-6 h-6 rounded shrink-0 flex items-center justify-center"
                  style={{ background: colors.fill, border: `1px solid ${colors.stroke}` }}
                >
                  <span className="text-[8px]" style={{ color: colors.accent }}>
                    {node.type.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-xs truncate flex-1">{node.label}</span>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                {!isSelected && isConnected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 opacity-70" />
                )}
              </button>
            );
          })}
        </div>

        <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
          <div className="grid grid-cols-2 gap-1 text-center">
            <div className="rounded bg-muted/30 py-1">
              <p className="text-sm font-medium text-foreground">{totalNodes}</p>
              <p className="text-[9px] text-muted-foreground">Entities</p>
            </div>
            <div className="rounded bg-muted/30 py-1">
              <p className="text-sm font-medium text-foreground">{totalEdges}</p>
              <p className="text-[9px] text-muted-foreground">Relations</p>
            </div>
          </div>
          <div className="mt-1.5 text-center">
            <span className="text-[9px] text-muted-foreground">
              v{version_label} · {status}
            </span>
          </div>
        </div>
      </div>

      {/* ──────────── CENTER: Graph ──────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 shrink-0 bg-[#06101e]">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded px-2.5 py-1.5">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Direct Relationships</span>
          </div>

          <div className="w-px h-5 bg-border/40" />

          <div className="flex items-center gap-0 rounded border border-border/60 overflow-hidden text-xs">
            {(["both", "outgoing", "incoming"] as Direction[]).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  direction === d
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                {d === "both" ? "Both" : d === "outgoing" ? "Outgoing" : "Incoming"}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border/40" />

          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded text-accent border border-accent/40 bg-accent/10">
              <GitFork className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded text-muted-foreground hover:text-foreground border border-border/40 hover:bg-muted/20 transition-colors">
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1" />

          <button
            className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))))}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground min-w-[38px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))))}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            onClick={resetView}
            title="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SVG */}
        <div className="flex-1 relative min-h-0 overflow-hidden">
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
              <marker id="ont-arrow-out" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M0,0.5 L8.5,4 L0,7.5" fill="none" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <marker id="ont-arrow-in" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M0,0.5 L8.5,4 L0,7.5" fill="none" stroke="#38BDF8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <filter id="ont-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="ont-shadow" x="-10%" y="-10%" width="120%" height="130%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
              </filter>
            </defs>

            <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
              {/* Edges */}
              {visibleEdges.map((edge) => {
                const result = getEdgePath(edge.source, edge.target);
                if (!result) return null;
                const isOutgoing = edge.source === selectedNodeId;
                const strokeColor = isOutgoing ? "#818CF8" : "#38BDF8";
                const markerId = isOutgoing ? "url(#ont-arrow-out)" : "url(#ont-arrow-in)";
                const rawLabel = edge.label ?? edge.type ?? "";
                const displayLabel = rawLabel.length > 20 ? `${rawLabel.slice(0, 19)}…` : rawLabel;
                const labelW = displayLabel.length * 5.8 + 10;

                return (
                  <g key={edge.id}>
                    <path d={result.path} fill="none" stroke={strokeColor} strokeOpacity="0.12" strokeWidth="5" />
                    <path d={result.path} fill="none" stroke={strokeColor} strokeOpacity="0.75" strokeWidth="1.5" markerEnd={markerId} />
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
              {nodes.map((node) => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;
                const isCenter = node.id === selectedNodeId;
                const colors = typeColors(node.type);
                const nx = pos.x - pos.w / 2;
                const ny = pos.y - pos.h / 2;
                const truncLabel = node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label;
                const iconSize = pos.h - 10;
                const iconX = nx + 6;
                const iconY = ny + 5;

                return (
                  <g
                    key={node.id}
                    data-node="true"
                    onClick={() => { setSelectedNodeId(node.id); setActiveTab("overview"); }}
                    style={{ cursor: "pointer" }}
                    filter={isCenter ? "url(#ont-glow)" : "url(#ont-shadow)"}
                  >
                    <rect x={nx} y={ny} width={pos.w} height={pos.h} rx={NODE_R}
                      fill={isCenter ? colors.fill : "#0a0f1a"}
                      stroke={colors.stroke}
                      strokeWidth={isCenter ? 1.8 : 1}
                    />
                    {/* Type accent strip */}
                    <rect x={nx} y={ny} width={pos.w} height={isCenter ? 4 : 3} rx={NODE_R}
                      fill={colors.stroke} fillOpacity="0.65"
                    />
                    {/* Icon box */}
                    <rect x={iconX} y={iconY} width={iconSize} height={iconSize} rx={4}
                      fill={isCenter ? colors.stroke + "33" : "#111827"}
                    />
                    <text x={iconX + iconSize / 2} y={iconY + iconSize / 2 + 1}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="8" fill={colors.accent} className="select-none" fontWeight="700"
                    >
                      {node.type.slice(0, 2).toUpperCase()}
                    </text>
                    {/* Label */}
                    <text
                      x={nx + iconSize + 14}
                      y={ny + (isCenter ? 18 : 15)}
                      fontSize={isCenter ? "11" : "10"}
                      fontWeight={isCenter ? "700" : "500"}
                      fill={isCenter ? colors.accent : "#bae6fd"}
                      className="select-none"
                    >
                      {truncLabel}
                    </text>
                    <text
                      x={nx + iconSize + 14}
                      y={ny + (isCenter ? 31 : 27)}
                      fontSize="8.5"
                      fill={colors.accent}
                      fillOpacity="0.6"
                      className="select-none"
                    >
                      {node.type}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Legend */}
          <div className="absolute bottom-3 left-4 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-px bg-[#818CF8]" />
              <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #818CF8" }} />
              <span className="text-[10px] text-muted-foreground">Outgoing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-px bg-[#38BDF8]" />
              <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #38BDF8" }} />
              <span className="text-[10px] text-muted-foreground">Incoming</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────── RIGHT: Detail Panel ──────────── */}
      <div className="w-[300px] shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
        {selectedNode ? (
          <>
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold"
                    style={{
                      background: typeColors(selectedNode.type).fill,
                      border: `1px solid ${typeColors(selectedNode.type).stroke}`,
                      color: typeColors(selectedNode.type).accent,
                    }}
                  >
                    {selectedNode.type.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate" title={selectedNode.label}>
                      {selectedNode.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{selectedNode.type}</p>
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-muted/40 transition-colors shrink-0">
                  <Star className="w-4 h-4 text-muted-foreground hover:text-yellow-400" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              {(["overview", "properties"] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-xs py-2.5 px-1 transition-colors border-b-2 capitalize ${
                    activeTab === tab
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* Overview */}
              {activeTab === "overview" && (
                <div className="p-4 flex flex-col gap-4">
                  {/* Description from meta */}
                  {selectedNode.meta?.description && (
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1">Description</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {selectedNode.meta.description}
                      </p>
                    </div>
                  )}

                  {/* Relationship stats */}
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Direct Relationships</p>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-md bg-muted/20 border border-border/60 p-2 text-center">
                        <p className="text-base font-semibold text-[#818CF8]">{relatedEdges.outgoing.length}</p>
                        <p className="text-[10px] text-muted-foreground">Outgoing</p>
                      </div>
                      <div className="flex-1 rounded-md bg-muted/20 border border-border/60 p-2 text-center">
                        <p className="text-base font-semibold text-[#38BDF8]">{relatedEdges.incoming.length}</p>
                        <p className="text-[10px] text-muted-foreground">Incoming</p>
                      </div>
                    </div>
                  </div>

                  {/* Outgoing */}
                  {relatedEdges.outgoing.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-[#818CF8] mb-1.5 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        Outgoing Relationships ({selectedNode.label} → Other)
                      </p>
                      <div className="space-y-1">
                        {relatedEdges.outgoing.map((edge) => {
                          const target = nodes.find((n) => n.id === edge.target);
                          return (
                            <button
                              key={edge.id}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                              onClick={() => { setSelectedNodeId(edge.target); setActiveTab("overview"); }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-[#818CF8] shrink-0" />
                                <span className="text-xs text-foreground truncate">{target?.label ?? edge.target}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                  {edge.label || edge.type}
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Incoming */}
                  {relatedEdges.incoming.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-[#38BDF8] mb-1.5 flex items-center gap-1">
                        <ArrowDownLeft className="w-3 h-3" />
                        Incoming Relationships (Other → {selectedNode.label})
                      </p>
                      <div className="space-y-1">
                        {relatedEdges.incoming.map((edge) => {
                          const source = nodes.find((n) => n.id === edge.source);
                          return (
                            <button
                              key={edge.id}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                              onClick={() => { setSelectedNodeId(edge.source); setActiveTab("overview"); }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-[#38BDF8] shrink-0" />
                                <span className="text-xs text-foreground truncate">{source?.label ?? edge.source}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                                  {edge.label || edge.type}
                                </span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {relatedEdges.all.length === 0 && (
                    <div className="text-center py-4">
                      <Database className="w-6 h-6 text-muted-foreground mx-auto mb-1.5" />
                      <p className="text-xs text-muted-foreground">No relationships found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Properties */}
              {activeTab === "properties" && (
                <div className="p-4 space-y-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Node ID</p>
                    <p className="text-xs text-foreground break-all">{selectedNode.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Type</p>
                    <p className="text-xs text-foreground">{selectedNode.type}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Label</p>
                    <p className="text-xs text-foreground">{selectedNode.label}</p>
                  </div>
                  {selectedNode.meta && Object.keys(selectedNode.meta).length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5">Meta</p>
                      <div className="space-y-2">
                        {Object.entries(selectedNode.meta).map(([key, value]) => (
                          <div key={key}>
                            <p className="text-[10px] text-muted-foreground">{key}</p>
                            <p className="text-xs text-foreground break-words">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-border shrink-0">
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => setActiveTab("properties")}
              >
                <Link2 className="w-3.5 h-3.5" />
                View Entity Details
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Select an entity to view details
          </div>
        )}
      </div>
    </div>
      )}
    </div>
  );
}
