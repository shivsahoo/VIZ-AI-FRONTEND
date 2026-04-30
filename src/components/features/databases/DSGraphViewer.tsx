import { useMemo, useRef, useState } from "react";
import { Database, Link2, KeyRound, TableProperties, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import type { DSGraphPayload } from "../../../services/api";

interface DSGraphViewerProps {
  graph: DSGraphPayload;
}

type PositionedNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  schema?: string | null;
  columnCount: number;
  pkCount: number;
  width: number;
  height: number;
};

const CANVAS_WIDTH = 2600;
const CANVAS_HEIGHT = 1800;
const NODE_WIDTH = 280;
const HEADER_HEIGHT = 34;
const ROW_HEIGHT = 22;
const MAX_VISIBLE_COLUMNS = 9;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.15;

export function DSGraphViewer({ graph }: DSGraphViewerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(graph.nodes[0]?.id ?? null);
  const [zoom, setZoom] = useState(0.75);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? graph.nodes[0],
    [graph.nodes, selectedNodeId]
  );

  const positionedNodes = useMemo<PositionedNode[]>(() => {
    const nodes = graph.nodes;
    if (!nodes.length) return [];

    const cols = Math.max(3, Math.ceil(Math.sqrt(nodes.length)));
    const xGap = NODE_WIDTH + 56;
    const yGap = 260;

    return nodes.map((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const visibleColumns = Math.min(node.columns.length, MAX_VISIBLE_COLUMNS);
      const height = HEADER_HEIGHT + 10 + visibleColumns * ROW_HEIGHT + 10;

      return {
        id: node.id,
        x: 40 + col * xGap,
        y: 40 + row * yGap,
        label: node.label,
        schema: node.schema,
        columnCount: node.column_count,
        pkCount: node.pk_columns.length,
        width: NODE_WIDTH,
        height,
      };
    });
  }, [graph.nodes]);

  const nodeMap = useMemo(() => new Map(positionedNodes.map((n) => [n.id, n])), [positionedNodes]);

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((current + delta).toFixed(2)))));
  };

  const resetView = () => {
    setZoom(0.75);
    setOffset({ x: 40, y: 40 });
  };

  const beginPan: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if ((event.target as HTMLElement).closest("[data-graph-controls='true']")) return;
    if ((event.target as HTMLElement).closest("[data-node-card='true']")) return;
    setIsPanning(true);
    panStart.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  };

  const onPanMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!isPanning || !panStart.current) return;
    const dx = event.clientX - panStart.current.x;
    const dy = event.clientY - panStart.current.y;
    setOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
  };

  const endPan = () => {
    setIsPanning(false);
    panStart.current = null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_340px] lg:grid-cols-[minmax(0,1fr)_360px] gap-4 w-full h-full min-h-0">
      <div className="rounded-xl border border-border bg-[#091225] p-3 overflow-hidden relative min-h-[340px] h-full flex flex-col">
        <div
          className="absolute top-3 right-3 z-20 flex items-center gap-2"
          data-graph-controls="true"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="h-8 w-8 rounded-md bg-slate-900/80 border border-slate-700 text-slate-200 flex items-center justify-center hover:bg-slate-800 transition-colors"
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, Number((z + ZOOM_STEP).toFixed(2))))}
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            className="h-8 w-8 rounded-md bg-slate-900/80 border border-slate-700 text-slate-200 flex items-center justify-center hover:bg-slate-800 transition-colors"
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, Number((z - ZOOM_STEP).toFixed(2))))}
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            className="h-8 w-8 rounded-md bg-slate-900/80 border border-slate-700 text-slate-200 flex items-center justify-center hover:bg-slate-800 transition-colors"
            onClick={resetView}
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="text-[11px] text-slate-300 min-w-[44px] text-right">{Math.round(zoom * 100)}%</span>
        </div>

        <div
          className={`w-full flex-1 min-h-[340px] rounded-lg select-none overflow-auto ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
          onWheel={handleWheel}
          onMouseDown={beginPan}
          onMouseMove={onPanMove}
          onMouseUp={endPan}
          onMouseLeave={endPan}
        >
          <svg
            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
            className="w-full h-full min-w-[1100px] min-h-[520px]"
          >
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#33C9FF" />
              </marker>
            </defs>

            <g transform={`translate(${offset.x}, ${offset.y}) scale(${zoom})`}>
              {graph.edges.map((edge) => {
                const source = nodeMap.get(edge.source);
                const target = nodeMap.get(edge.target);
                if (!source || !target) return null;

                const sourceRight = source.x + source.width;
                const sourceCenterY = source.y + source.height / 2;
                const targetLeft = target.x;
                const targetCenterY = target.y + target.height / 2;
                const sourceLeft = source.x;
                const targetRight = target.x + target.width;
                const toRight = targetLeft >= sourceRight;
                const sx = toRight ? sourceRight : sourceLeft;
                const tx = toRight ? targetLeft : targetRight;
                const controlOffset = Math.max(40, Math.abs(tx - sx) * 0.4);
                const c1x = toRight ? sx + controlOffset : sx - controlOffset;
                const c2x = toRight ? tx - controlOffset : tx + controlOffset;
                const path = `M ${sx} ${sourceCenterY} C ${c1x} ${sourceCenterY}, ${c2x} ${targetCenterY}, ${tx} ${targetCenterY}`;
                const lx = (sx + tx) / 2;
                const ly = (sourceCenterY + targetCenterY) / 2 - 4;

                return (
                  <g key={edge.id}>
                    <path
                      d={path}
                      fill="none"
                      stroke="#38BDF8"
                      strokeOpacity="0.82"
                      strokeWidth="1.8"
                      markerEnd="url(#arrow)"
                    />
                    <text x={lx} y={ly} textAnchor="middle" fontSize="11" fill="#8CDFFF">
                      {edge.label}
                    </text>
                  </g>
                );
              })}

              {positionedNodes.map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const nodeData = graph.nodes.find((n) => n.id === node.id);
                const visibleCols = nodeData?.columns?.slice(0, MAX_VISIBLE_COLUMNS) || [];
                const hiddenCount = Math.max(0, (nodeData?.columns?.length || 0) - visibleCols.length);

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    data-node-card="true"
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={node.height}
                      rx={8}
                      fill={isSelected ? "#0E2A45" : "#0B1E36"}
                      stroke={isSelected ? "#67E8F9" : "#1D4E89"}
                      strokeWidth={isSelected ? 2.2 : 1.2}
                    />

                    <rect
                      x={node.x}
                      y={node.y}
                      width={node.width}
                      height={HEADER_HEIGHT}
                      rx={8}
                      fill={isSelected ? "#123A5C" : "#123152"}
                    />
                    <rect
                      x={node.x}
                      y={node.y + HEADER_HEIGHT - 8}
                      width={node.width}
                      height={8}
                      fill={isSelected ? "#123A5C" : "#123152"}
                    />

                    <text x={node.x + 10} y={node.y + 15} fontSize="11.5" fill="#E6F4FF" fontWeight="600">
                      {node.label.length > 30 ? `${node.label.slice(0, 30)}...` : node.label}
                    </text>
                    <text x={node.x + 10} y={node.y + 28} fontSize="10" fill="#9CC1E5">
                      {node.schema || "default"} • {node.columnCount} cols
                    </text>

                    {visibleCols.map((col, index) => {
                      const y = node.y + HEADER_HEIGHT + 16 + index * ROW_HEIGHT;
                      return (
                        <g key={`${node.id}-${col.name}`}>
                          <text x={node.x + 12} y={y} fontSize="10.5" fill={col.is_primary_key ? "#FDE68A" : "#CBE8FF"}>
                            {col.is_primary_key ? "PK" : "•"}
                          </text>
                          <text x={node.x + 32} y={y} fontSize="10.5" fill="#D6E9FF">
                            {col.name.length > 18 ? `${col.name.slice(0, 18)}...` : col.name}
                          </text>
                          <text x={node.x + node.width - 10} y={y} textAnchor="end" fontSize="10" fill="#94A3B8">
                            {col.type}
                          </text>
                        </g>
                      );
                    })}

                    {hiddenCount > 0 && (
                      <text x={node.x + 10} y={node.y + node.height - 8} fontSize="10" fill="#7FA6CA">
                        +{hiddenCount} more columns
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4 min-h-[340px] h-full overflow-hidden">
        <div className="flex items-center justify-between shrink-0">
          <h3 className="text-sm text-foreground">Graph Summary</h3>
          <Database className="w-4 h-4 text-accent" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center shrink-0">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-lg text-foreground">{graph.stats.table_count}</p>
            <p className="text-[10px] text-muted-foreground">Tables</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-lg text-foreground">{graph.stats.relation_count}</p>
            <p className="text-[10px] text-muted-foreground">Relations</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-lg text-foreground">{graph.stats.orphan_table_count}</p>
            <p className="text-[10px] text-muted-foreground">Orphans</p>
          </div>
        </div>

        {selectedNode ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
            <div className="rounded-lg bg-muted/30 border border-border p-3 overflow-x-auto shrink-0">
              <p className="text-sm text-foreground whitespace-nowrap">{selectedNode.label}</p>
              <p className="text-xs text-muted-foreground whitespace-nowrap">{selectedNode.id}</p>
            </div>

            <div className="text-xs text-muted-foreground flex items-center gap-2 shrink-0">
              <TableProperties className="w-3 h-3" /> Columns ({selectedNode.column_count})
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-md border border-border bg-card/50">
              {selectedNode.columns.map((col) => (
                <div key={`${selectedNode.id}-${col.name}`} className="flex items-center justify-between px-3 py-2 border-b border-border/60 last:border-b-0">
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    {col.is_primary_key ? (
                      <KeyRound className="w-3 h-3 text-yellow-400 shrink-0" />
                    ) : (
                      <Link2 className="w-3 h-3 text-cyan-300 shrink-0" />
                    )}
                    <span className="text-foreground truncate max-w-[200px]" title={col.name}>{col.name}</span>
                  </div>
                  <span className="text-muted-foreground text-[11px] ml-2 shrink-0 max-w-[110px] truncate" title={col.type}>{col.type}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No node selected.</p>
        )}
      </div>
    </div>
  );
}
