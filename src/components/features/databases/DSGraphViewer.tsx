import { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  KeyRound,
  Link2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  ChevronRight,
  TableProperties,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
  Shuffle,
  LayoutGrid,
  GitFork,
} from "lucide-react";
import type { DSGraphPayload } from "../../../services/api";

type Direction = "both" | "outgoing" | "incoming";
type ActiveTab = "overview" | "columns" | "properties";

interface DSGraphViewerProps {
  graph: DSGraphPayload;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.15;

// SVG canvas dimensions
const SVG_W = 900;
const SVG_H = 500;
const CX = SVG_W / 2;
const CY = SVG_H / 2;

// Node box dimensions
const CENTER_W = 170;
const CENTER_H = 46;
const NODE_W = 148;
const NODE_H = 38;
const NODE_R = 8; // border-radius

function getNodeStyle(isCenter: boolean, isConnected: boolean) {
  if (isCenter) {
    return { fill: "#312e81", stroke: "#818CF8", textFill: "#e0e7ff", labelFill: "#a5b4fc" };
  }
  if (isConnected) {
    return { fill: "#0f172a", stroke: "#3B82F6", textFill: "#bae6fd", labelFill: "#64748b" };
  }
  return { fill: "#0a0f1a", stroke: "#1e293b", textFill: "#475569", labelFill: "#334155" };
}

export function DSGraphViewer({ graph }: DSGraphViewerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    graph.nodes[0]?.id ?? ""
  );
  const [direction, setDirection] = useState<Direction>("both");
  const [activeTab, setActiveTab] = useState<ActiveTab>("overview");
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? graph.nodes[0],
    [graph.nodes, selectedNodeId]
  );

  // Partition edges by direction relative to selected node
  const relatedEdges = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [], incoming: [], all: [] };
    const outgoing = graph.edges.filter((e) => e.source === selectedNodeId);
    const incoming = graph.edges.filter((e) => e.target === selectedNodeId);
    return { outgoing, incoming, all: [...outgoing, ...incoming] };
  }, [selectedNodeId, graph.edges]);

  // Edges visible in graph based on direction filter
  const visibleEdges = useMemo(() => {
    if (direction === "outgoing") return relatedEdges.outgoing;
    if (direction === "incoming") return relatedEdges.incoming;
    return relatedEdges.all;
  }, [direction, relatedEdges]);

  // IDs of nodes connected via visible edges
  const connectedIds = useMemo(
    () =>
      new Set(
        visibleEdges
          .flatMap((e) => [e.source, e.target])
          .filter((id) => id !== selectedNodeId)
      ),
    [visibleEdges, selectedNodeId]
  );

  // Radial layout: only the selected node + its VISIBLE neighbors
  // Radius is computed to give each node enough arc-space (no hard cap).
  // We also derive a suggestedZoom so everything always fits in the viewBox.
  const { nodePositions, suggestedZoom } = useMemo(() => {
    const neighborNodes = graph.nodes.filter(
      (n) => n.id !== selectedNodeId && connectedIds.has(n.id)
    );
    const count = neighborNodes.length;

    // Minimum radius so adjacent nodes don't overlap (arc gap >= NODE_W + padding)
    const minGap = NODE_W + 28;
    const properRadius =
      count <= 1 ? 190 : minGap / (2 * Math.tan(Math.PI / count));
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

    // Auto-fit: scale so the whole ring (radius + half node size + padding) fits
    // inside the SVG viewBox, keeping CX/CY at the visual center.
    const extent = radius + NODE_W * 0.6 + 16; // farthest point from center
    const fitScale = count === 0 ? 1 : Math.min(1, Math.min(CX, CY) / extent);
    const zoom = Math.max(0.28, fitScale);

    return { nodePositions: positions, suggestedZoom: zoom };
  }, [selectedNodeId, graph.nodes, connectedIds]);

  // When the selected node changes, apply the auto-fit zoom/offset immediately
  const prevNodeIdRef = useRef(selectedNodeId);
  useEffect(() => {
    if (prevNodeIdRef.current !== selectedNodeId) {
      prevNodeIdRef.current = selectedNodeId;
      // Offset keeps CX/CY visually centred after the zoom change
      setOffset({ x: CX * (1 - suggestedZoom), y: CY * (1 - suggestedZoom) });
      setZoom(suggestedZoom);
    }
  }, [selectedNodeId, suggestedZoom]);

  // Compute a gently-curved quadratic bezier edge path
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

    // Start at source node boundary, end just before target (room for arrowhead)
    const startX = src.x + ux * (src.w / 2 + 2);
    const startY = src.y + uy * (src.h / 2 + 2);
    const endX   = tgt.x - ux * (tgt.w / 2 + 9);
    const endY   = tgt.y - uy * (tgt.h / 2 + 9);

    // Quadratic control point: midpoint offset perpendicular to the line
    const curveAmt = Math.min(dist * 0.18, 30);
    const mx = (startX + endX) / 2 - uy * curveAmt;
    const my = (startY + endY) / 2 + ux * curveAmt;

    // Label position at curve midpoint (t=0.5 on quadratic bezier)
    const lx = 0.25 * startX + 0.5 * mx + 0.25 * endX;
    const ly = 0.25 * startY + 0.5 * my + 0.25 * endY;

    return {
      path: `M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`,
      lx,
      ly,
    };
  };

  // Filtered entity list for left panel
  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return graph.nodes.filter(
      (n) =>
        !q ||
        n.label.toLowerCase().includes(q) ||
        (n.schema ?? "").toLowerCase().includes(q)
    );
  }, [graph.nodes, search]);

  const handleWheel: React.WheelEventHandler<SVGSVGElement> = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((z) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((z + delta).toFixed(2))))
    );
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

  // Counts for the right panel
  const outgoingCount = relatedEdges.outgoing.length;
  const incomingCount = relatedEdges.incoming.length;

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card">
      {/* ────────────────── LEFT: Entity List ────────────────── */}
      <div className="w-52 shrink-0 flex flex-col border-r border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
          <span className="text-sm font-medium text-foreground">Entities</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">
            {graph.stats.table_count} Total
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
            return (
              <button
                key={node.id}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors mb-0.5 group ${
                  isSelected
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "hover:bg-muted/50 text-foreground"
                }`}
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setActiveTab("overview");
                }}
              >
                <div
                  className={`w-6 h-6 rounded shrink-0 flex items-center justify-center ${
                    isSelected ? "bg-primary/30" : "bg-muted/50"
                  }`}
                >
                  <TableProperties className={`w-3 h-3 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
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
          <div className="grid grid-cols-3 gap-1 text-center">
            <div className="rounded bg-muted/30 py-1">
              <p className="text-sm font-medium text-foreground">{graph.stats.table_count}</p>
              <p className="text-[9px] text-muted-foreground">Tables</p>
            </div>
            <div className="rounded bg-muted/30 py-1">
              <p className="text-sm font-medium text-foreground">{graph.stats.relation_count}</p>
              <p className="text-[9px] text-muted-foreground">Relations</p>
            </div>
            <div className="rounded bg-muted/30 py-1">
              <p className="text-sm font-medium text-foreground">{graph.stats.orphan_table_count}</p>
              <p className="text-[9px] text-muted-foreground">Orphans</p>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── CENTER: Graph Canvas ────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 shrink-0 bg-[#06101e]">
          {/* View label */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded px-2.5 py-1.5">
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Direct Relationships</span>
          </div>

          <div className="w-px h-5 bg-border/40" />

          {/* Direction filter */}
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

          {/* Layout toggle icons */}
          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded text-accent border border-accent/40 bg-accent/10">
              <GitFork className="w-3.5 h-3.5" />
            </button>
            <button className="p-1.5 rounded text-muted-foreground hover:text-foreground border border-border/40 hover:bg-muted/20 transition-colors">
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1" />

          {/* Zoom controls */}
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

        {/* SVG Graph */}
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
              {/* Slim open-chevron arrowheads */}
              <marker id="arrow-out" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M0,0.5 L8.5,4 L0,7.5" fill="none" stroke="#818CF8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              <marker id="arrow-in" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto">
                <path d="M0,0.5 L8.5,4 L0,7.5" fill="none" stroke="#38BDF8" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </marker>
              {/* Soft glow for center node */}
              <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Subtle drop-shadow for all nodes */}
              <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
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
                const markerId = isOutgoing ? "url(#arrow-out)" : "url(#arrow-in)";
                const rawLabel = edge.label ?? "";
                const displayLabel =
                  rawLabel.length > 18 ? `${rawLabel.slice(0, 17)}…` : rawLabel;
                const labelW = displayLabel.length * 5.8 + 10;

                return (
                  <g key={edge.id}>
                    {/* Glow halo under the edge */}
                    <path
                      d={result.path}
                      fill="none"
                      stroke={strokeColor}
                      strokeOpacity="0.12"
                      strokeWidth="5"
                    />
                    {/* Main edge line */}
                    <path
                      d={result.path}
                      fill="none"
                      stroke={strokeColor}
                      strokeOpacity="0.75"
                      strokeWidth="1.5"
                      strokeDasharray="none"
                      markerEnd={markerId}
                    />
                    {/* Label pill */}
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
              {graph.nodes.map((node) => {
                const pos = nodePositions.get(node.id);
                if (!pos) return null;
                const isCenter = node.id === selectedNodeId;
                const isConnected = connectedIds.has(node.id);
                const style = getNodeStyle(isCenter, isConnected);
                const nx = pos.x - pos.w / 2;
                const ny = pos.y - pos.h / 2;
                const truncLabel =
                  node.label.length > 18 ? `${node.label.slice(0, 18)}…` : node.label;
                const truncSchema =
                  (node.schema ?? "table").length > 14
                    ? `${(node.schema ?? "table").slice(0, 14)}…`
                    : node.schema ?? "table";

                const iconSize = pos.h - 10;
                const iconX = nx + 6;
                const iconY = ny + 5;
                const iconBg = isCenter ? "#4338ca" : isConnected ? "#1a3460" : "#161e2e";
                const iconAccent = isCenter ? "#a5b4fc" : isConnected ? "#60a5fa" : "#334155";
                const textX = nx + iconSize + 14;

                return (
                  <g
                    key={node.id}
                    data-node="true"
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      setActiveTab("overview");
                    }}
                    style={{ cursor: "pointer" }}
                    filter={isCenter ? "url(#glow)" : "url(#shadow)"}
                  >
                    {/* Card background */}
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
                    {/* Gradient header strip */}
                    <rect
                      x={nx}
                      y={ny}
                      width={pos.w}
                      height={isCenter ? 4 : 3}
                      rx={NODE_R}
                      fill={isCenter ? "#818CF8" : isConnected ? "#38BDF8" : "#334155"}
                      fillOpacity="0.7"
                    />
                    {/* Mini table icon */}
                    <rect x={iconX} y={iconY} width={iconSize} height={iconSize} rx={4} fill={iconBg} />
                    {/* table header row */}
                    <rect x={iconX + 2} y={iconY + 2} width={iconSize - 4} height={3.5} rx={1} fill={iconAccent} fillOpacity="0.9" />
                    {/* table data rows */}
                    <rect x={iconX + 2} y={iconY + 7} width={iconSize - 4} height={2.5} rx={0.8} fill={iconAccent} fillOpacity="0.45" />
                    <rect x={iconX + 2} y={iconY + 11} width={iconSize - 7} height={2.5} rx={0.8} fill={iconAccent} fillOpacity="0.3" />
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
                    {/* Sub-label */}
                    <text
                      x={textX}
                      y={ny + (isCenter ? 31 : 27)}
                      fontSize="8.5"
                      fill={style.labelFill}
                      className="select-none"
                    >
                      {isCenter ? `${truncSchema} • ${node.column_count} cols` : truncSchema}
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
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "4px solid transparent",
                  borderBottom: "4px solid transparent",
                  borderLeft: "6px solid #818CF8",
                }}
              />
              <span className="text-[10px] text-muted-foreground">Outgoing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-px bg-[#38BDF8]" />
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "4px solid transparent",
                  borderBottom: "4px solid transparent",
                  borderLeft: "6px solid #38BDF8",
                }}
              />
              <span className="text-[10px] text-muted-foreground">Incoming</span>
            </div>
          </div>
        </div>
      </div>

      {/* ────────────────── RIGHT: Detail Panel ────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col border-l border-border bg-card overflow-hidden">
        {selectedNode ? (
          <>
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                    <TableProperties className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate" title={selectedNode.label}>
                      {selectedNode.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Entity / Table</p>
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-muted/40 transition-colors shrink-0">
                  <Star className="w-4 h-4 text-muted-foreground hover:text-yellow-400" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              {(["overview", "columns", "properties"] as ActiveTab[]).map((tab) => {
                const labels: Record<ActiveTab, string> = {
                  overview: "Overview",
                  columns: `Columns (${selectedNode.column_count})`,
                  properties: "Properties",
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 text-xs py-2.5 px-1 transition-colors border-b-2 ${
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* ── Overview Tab ── */}
              {activeTab === "overview" && (
                <div className="p-4 flex flex-col gap-4">
                  {/* Description */}
                  <div>
                    <p className="text-xs font-medium text-foreground mb-1">Description</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedNode.schema
                        ? `Table in schema "${selectedNode.schema}"${selectedNode.catalog ? `, catalog "${selectedNode.catalog}"` : ""}.`
                        : `Database table with ${selectedNode.column_count} column${selectedNode.column_count !== 1 ? "s" : ""}.`}
                      {selectedNode.pk_columns.length > 0 &&
                        ` Primary key: ${selectedNode.pk_columns.slice(0, 2).join(", ")}${selectedNode.pk_columns.length > 2 ? "…" : ""}.`}
                    </p>
                  </div>

                  {/* Relationship counts */}
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Direct Relationships</p>
                    <div className="flex gap-2">
                      <div className="flex-1 rounded-md bg-muted/20 border border-border/60 p-2 text-center">
                        <p className="text-base font-semibold text-[#818CF8]">{outgoingCount}</p>
                        <p className="text-[10px] text-muted-foreground">Outgoing</p>
                      </div>
                      <div className="flex-1 rounded-md bg-muted/20 border border-border/60 p-2 text-center">
                        <p className="text-base font-semibold text-[#38BDF8]">{incomingCount}</p>
                        <p className="text-[10px] text-muted-foreground">Incoming</p>
                      </div>
                      <div className="flex-1 rounded-md bg-muted/20 border border-border/60 p-2 text-center">
                        <p className="text-base font-semibold text-muted-foreground">
                          {graph.stats.orphan_table_count}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Orphans</p>
                      </div>
                    </div>
                  </div>

                  {/* Outgoing list */}
                  {relatedEdges.outgoing.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-[#818CF8] mb-1.5 flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        Outgoing Relationships ({selectedNode.label} → Other)
                      </p>
                      <div className="space-y-1">
                        {relatedEdges.outgoing.map((edge) => {
                          const targetNode = graph.nodes.find((n) => n.id === edge.target);
                          return (
                            <button
                              key={edge.id}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                              onClick={() => {
                                setSelectedNodeId(edge.target);
                                setActiveTab("overview");
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-[#818CF8] shrink-0" />
                                <span className="text-xs text-foreground truncate">
                                  {targetNode?.label ?? edge.target}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] text-muted-foreground">{edge.label}</span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Incoming list */}
                  {relatedEdges.incoming.length > 0 && (
                    <div>
                      <p className="text-[11px] font-medium text-[#38BDF8] mb-1.5 flex items-center gap-1">
                        <ArrowDownLeft className="w-3 h-3" />
                        Incoming Relationships (Other → {selectedNode.label})
                      </p>
                      <div className="space-y-1">
                        {relatedEdges.incoming.map((edge) => {
                          const sourceNode = graph.nodes.find((n) => n.id === edge.source);
                          return (
                            <button
                              key={edge.id}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                              onClick={() => {
                                setSelectedNodeId(edge.source);
                                setActiveTab("overview");
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-[#38BDF8] shrink-0" />
                                <span className="text-xs text-foreground truncate">
                                  {sourceNode?.label ?? edge.source}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <span className="text-[10px] text-muted-foreground">{edge.label}</span>
                                <ChevronRight className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
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

              {/* ── Columns Tab ── */}
              {activeTab === "columns" && (
                <div className="divide-y divide-border/60">
                  {selectedNode.columns.map((col) => (
                    <div
                      key={`${selectedNode.id}-${col.name}`}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {col.is_primary_key ? (
                          <KeyRound className="w-3 h-3 text-yellow-400 shrink-0" />
                        ) : (
                          <Link2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-xs text-foreground truncate" title={col.name}>
                          {col.name}
                        </span>
                      </div>
                      <span
                        className="text-[10px] text-muted-foreground ml-2 shrink-0 max-w-[90px] truncate"
                        title={col.type}
                      >
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Properties Tab ── */}
              {activeTab === "properties" && (
                <div className="p-4 space-y-3">
                  {[
                    { label: "Table Name", value: selectedNode.table },
                    { label: "Schema", value: selectedNode.schema ?? "—" },
                    { label: "Catalog", value: selectedNode.catalog ?? "—" },
                    { label: "Column Count", value: String(selectedNode.column_count) },
                    { label: "Primary Keys", value: selectedNode.pk_columns.length > 0 ? selectedNode.pk_columns.join(", ") : "—" },
                    { label: "Node ID", value: selectedNode.id },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                      <p className="text-xs text-foreground truncate" title={value}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* View Entity Details button */}
            <div className="p-3 border-t border-border shrink-0">
              <button
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md border border-border/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                onClick={() => setActiveTab("columns")}
              >
                <TableProperties className="w-3.5 h-3.5" />
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
  );
}
