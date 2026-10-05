import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, RefreshCw, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, Clock, AlertTriangle, Zap, DollarSign,
  Cpu, BarChart2, ChevronLeft, X, Database, Bot, Radio, GanttChartSquare, Rows3,
} from "lucide-react";
import { ChartCard } from "../components/features/charts/ChartCard";
import "./Observability.css";
import { getTraces, getTraceDetail, getUsageAnalytics, type LLMTrace, type UsageAnalytics } from "../services/api";

const POLL_INTERVAL_MS = 4000; // real-time polling interval

interface ObservabilityViewProps {
  projectId?: string | number;
}

// Only the services that are actually instrumented and visible to users
const AI_SERVICE_LABELS: Record<string, string> = {
  chart_creation: "Chart Generation",
  probe_mode: "Probe Mode",
  ai_assistant: "AI Assistant",
};

// Tone slot per service (see .obs-tone-* in Observability.css)
const SERVICE_TONE: Record<string, string> = {
  chart_creation: "blue",
  probe_mode: "indigo",
  ai_assistant: "teal",
};
const serviceTone = (service: string) => SERVICE_TONE[service] ?? "gray";

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: "is-success", label: "Success" },
  error: { icon: XCircle, color: "is-error", label: "Error" },
  timeout: { icon: Clock, color: "is-timeout", label: "Timeout" },
  cancelled: { icon: AlertTriangle, color: "is-cancelled", label: "Cancelled" },
};

function formatLatency(ms: number | null) {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function formatCost(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.0001) return `$${n.toFixed(8)}`;
  if (n < 0.01) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(4)}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, accent = false }: {
  label: string; value: string; sub?: string; icon: any; accent?: boolean;
}) {
  return (
    <div className={`obs-stat${accent ? " is-accent" : ""}`}>
      <span className="obs-stat-icon"><Icon className="w-4 h-4" aria-hidden="true" /></span>
      <span className="obs-stat-label">{label}</span>
      <span className="obs-stat-value">{value}</span>
      {sub && <span className="obs-stat-sub">{sub}</span>}
    </div>
  );
}

function ServiceBadge({ service }: { service: string }) {
  return (
    <span className={`obs-service obs-tone-${serviceTone(service)}`}>
      <span className="obs-service-dot" aria-hidden="true" />
      {AI_SERVICE_LABELS[service] ?? service.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  const Icon = cfg.icon;
  return (
    <span className={`obs-status ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

/** Nice round axis maximum for the latency scale. */
function niceCeil(ms: number) {
  const steps = [1000, 2000, 5000, 10000, 15000, 20000, 30000, 45000, 60000, 90000, 120000, 300000];
  return steps.find((s) => s >= ms) ?? Math.ceil(ms / 60000) * 60000;
}

function TraceTimeline({ traces, onSelect }: { traces: LLMTrace[]; onSelect: (t: LLMTrace) => void }) {
  const maxLatency = Math.max(1000, ...traces.map((t) => t.latency_ms ?? 0));
  const axisMax = niceCeil(maxLatency);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * axisMax);
  return (
    <div className="obs-timeline" role="table" aria-label="Traces by latency">
      <div className="obs-tl-head" role="row">
        <span role="columnheader">Call</span>
        <div className="obs-tl-axis" role="columnheader" aria-label="Latency">
          {ticks.map((t, i) => (
            <span key={i} style={{ left: `${(t / axisMax) * 100}%` }}>{formatLatency(t)}</span>
          ))}
        </div>
        <span role="columnheader">Status</span>
        <span role="columnheader" className="text-right">Cost</span>
      </div>
      {traces.map((trace) => {
        const pct = Math.max(2, ((trace.latency_ms ?? 0) / axisMax) * 100);
        const tone = trace.status === "error" ? "red" : trace.status === "timeout" ? "orange" : serviceTone(trace.ai_service);
        return (
          <div
            key={trace.id}
            className="obs-tl-row"
            role="row"
            tabIndex={0}
            onClick={() => onSelect(trace)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(trace);
              }
            }}
          >
            <div className="obs-tl-call" role="cell">
              <span className={`obs-tl-icon obs-tone-${serviceTone(trace.ai_service)}`} aria-hidden="true">
                {trace.ai_service === "chart_creation" ? <BarChart2 className="w-4 h-4" /> : trace.ai_service === "ai_assistant" ? <Bot className="w-4 h-4" /> : trace.ai_service === "probe_mode" ? <Zap className="w-4 h-4" /> : <Database className="w-4 h-4" />}
              </span>
              <div className="min-w-0">
                <p className="obs-tl-name">{AI_SERVICE_LABELS[trace.ai_service] ?? trace.ai_service.replace(/_/g, " ")}</p>
                <p className="obs-tl-meta">
                  <span className="obs-chip">#{trace.id.slice(0, 6)}</span>
                  <span className="truncate">{trace.model_name ?? "unknown model"}</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">{trace.created_at ? timeAgo(trace.created_at) : "—"}</span>
                </p>
              </div>
            </div>
            <div className="obs-tl-track" role="cell">
              {ticks.slice(1, -1).map((t, i) => (
                <span key={i} className="obs-tl-grid" style={{ left: `${(t / axisMax) * 100}%` }} aria-hidden="true" />
              ))}
              <div className={`obs-tl-bar obs-tone-${tone}${pct < 22 ? " is-short" : ""}`} style={{ width: `${pct}%` }}>
                <span className="obs-tl-bar-label">
                  {formatLatency(trace.latency_ms)}
                  {trace.total_tokens > 0 && <span className="obs-tl-bar-sub"> · {formatTokens(trace.total_tokens)} tok</span>}
                </span>
              </div>
            </div>
            <div role="cell"><StatusBadge status={trace.status} /></div>
            <div role="cell" className="obs-tl-cost">{formatCost(trace.estimated_cost_usd)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Trace Detail Drawer ──────────────────────────────────────────────────────

function TraceDetail({ trace, onClose }: { trace: LLMTrace | null; onClose: () => void }) {
  const [full, setFull] = useState<LLMTrace | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [showSteps, setShowSteps] = useState(true); // open by default

  useEffect(() => {
    if (!trace) return;
    setFull(null);
    setShowCompletion(false);
    setShowSteps(true);
    setLoadingFull(true);
    getTraceDetail(trace.id).then((r) => {
      if (r.success && r.data) setFull(r.data);
    }).finally(() => setLoadingFull(false));
  }, [trace?.id]);

  if (!trace) return null;
  const data = full ?? trace;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl h-full bg-card border-l border-border overflow-y-auto shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Trace Detail</span>
            <ServiceBadge service={data.ai_service} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6 space-y-6">
          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Trace ID</p>
              <p className="text-xs font-mono text-foreground truncate">{data.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Session</p>
              <p className="text-xs font-mono text-foreground truncate">{data.session_id ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Model</p>
              <p className="text-sm font-medium text-foreground">{data.model_name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Provider</p>
              <p className="text-sm font-medium text-foreground capitalize">{data.llm_provider ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <StatusBadge status={data.status} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Timestamp</p>
              <p className="text-sm text-foreground">{data.created_at ? formatDate(data.created_at) : "—"}</p>
            </div>
          </div>

          {/* Token + cost */}
          <div className="rounded-xl border border-border p-4 grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Prompt</p>
              <p className="text-lg font-bold text-foreground">{formatTokens(data.prompt_tokens)}</p>
              <p className="text-xs text-muted-foreground">tokens</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Completion</p>
              <p className="text-lg font-bold text-foreground">{formatTokens(data.completion_tokens)}</p>
              <p className="text-xs text-muted-foreground">tokens</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-primary">{formatTokens(data.total_tokens)}</p>
              <p className="text-xs text-muted-foreground">tokens</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Est. Cost</p>
              <p className="text-lg font-bold text-foreground">{formatCost(data.estimated_cost_usd)}</p>
              <p className="text-xs text-muted-foreground">USD</p>
            </div>
          </div>

          {/* Latency */}
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Latency: </span>
              <span className="text-foreground font-medium">
                {data.latency_ms != null ? `${data.latency_ms}ms` : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">SQL retries: </span>
              <span className="text-foreground font-medium">{data.sql_retries}</span>
            </div>
          </div>

          {/* Error */}
          {data.error_message && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs text-red-400 font-semibold mb-1">Error</p>
              <p className="text-xs text-red-300 font-mono">{data.error_message}</p>
            </div>
          )}

          {/* SQL */}
          {data.sql_generated && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Generated SQL</p>
              <pre className="text-xs font-mono bg-muted/40 border border-border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-5 text-foreground">
                {data.sql_generated}
              </pre>
            </div>
          )}

          {/* Schema tables */}
          {data.schema_tables_used && data.schema_tables_used.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Schema Context</p>
              <div className="flex flex-wrap gap-2">
                {data.schema_tables_used.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 bg-muted/40 border border-border rounded font-mono text-muted-foreground">
                    <Database className="w-3 h-3 inline mr-1 opacity-60" />{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* LLM Response */}
          {loadingFull && (
            <p className="text-xs text-muted-foreground animate-pulse">Loading full trace…</p>
          )}

          {data.completion_text && (
            <div>
              <button
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors w-full"
                onClick={() => setShowCompletion((s) => !s)}
              >
                <Bot className="w-3.5 h-3.5" />
                LLM Response
                {showCompletion ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>
              {showCompletion && (
                <pre className="text-xs font-mono bg-muted/40 border border-border rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-5 text-foreground max-h-64">
                  {data.completion_text}
                </pre>
              )}
            </div>
          )}

          {/* ── Reasoning Trace ─────────────────────────────────────── */}
          {data.agent_steps && data.agent_steps.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 hover:text-foreground transition-colors w-full"
                onClick={() => setShowSteps((s) => !s)}
              >
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>Reasoning &amp; Execution Flow</span>
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                  {data.agent_steps.length}
                </span>
                {showSteps ? <ChevronDown className="w-3.5 h-3.5 ml-auto" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto" />}
              </button>

              {showSteps && (() => {
                // Separate workflow steps from LangChain internal steps
                const workflowSteps = data.agent_steps.filter((s: any) => !!s.step);
                const chainSteps = data.agent_steps.filter((s: any) => !s.step);

                // Compute relative timestamps within workflow steps
                const firstTs = workflowSteps.length > 0 ? workflowSteps[0].ts : null;

                return (
                  <div className="space-y-6">
                    {/* ── Workflow Timeline ── */}
                    {workflowSteps.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Zap className="w-3 h-3" /> Workflow steps
                        </p>
                        <div className="relative pl-5">
                          {/* vertical spine */}
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />

                          <div className="space-y-3">
                            {workflowSteps.map((step: any, i: number) => {
                              const label = step.step
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c: string) => c.toUpperCase());

                              const isLast = i === workflowSteps.length - 1;
                              const resultColor =
                                step.result === true || step.result === "pass"
                                  ? "bg-green-500 border-green-400"
                                  : step.result === false || step.result === "skip"
                                  ? "bg-yellow-500 border-yellow-400"
                                  : step.result === "fail"
                                  ? "bg-red-500 border-red-400"
                                  : "bg-primary border-primary/60";

                              const badge =
                                step.result === true || step.result === "pass" ? (
                                  <span className="px-1.5 py-0.5 rounded text-green-400 bg-green-500/10 border border-green-500/20 text-[10px] font-medium">pass</span>
                                ) : step.result === false || step.result === "skip" ? (
                                  <span className="px-1.5 py-0.5 rounded text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-medium">skip</span>
                                ) : step.result === "fail" ? (
                                  <span className="px-1.5 py-0.5 rounded text-red-400 bg-red-500/10 border border-red-500/20 text-[10px] font-medium">fail</span>
                                ) : null;

                              const relMs =
                                firstTs && step.ts
                                  ? Math.round((step.ts - firstTs) * 1000)
                                  : null;

                              const details = Object.entries(step)
                                .filter(([k]) => !["step", "ts", "result"].includes(k))
                                .slice(0, 4);

                              return (
                                <div key={i} className="relative flex items-start gap-3">
                                  {/* dot */}
                                  <div className={`absolute -left-5 w-3.5 h-3.5 rounded-full border-2 ${resultColor} shadow-sm mt-0.5 flex items-center justify-center shrink-0`} />

                                  {/* card */}
                                  <div className={`flex-1 rounded-lg border px-3 py-2.5 text-xs ${isLast ? "bg-primary/8 border-primary/25" : "bg-muted/25 border-border"}`}>
                                    <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                                        {label}
                                        {badge}
                                      </span>
                                      {relMs !== null && (
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                          +{relMs < 1000 ? `${relMs}ms` : `${(relMs / 1000).toFixed(1)}s`}
                                        </span>
                                      )}
                                    </div>
                                    {details.length > 0 && (
                                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                                        {details.map(([k, v]) => (
                                          <span key={k}>
                                            <span className="text-foreground/50">{k}:</span>{" "}
                                            <span className="font-mono">
                                              {typeof v === "object"
                                                ? JSON.stringify(v).slice(0, 60)
                                                : String(v).slice(0, 80)}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── LangChain Internal Steps ── */}
                    {chainSteps.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                          <Cpu className="w-3 h-3" /> LLM chain steps
                        </p>
                        <div className="relative pl-5">
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-muted-foreground/40 via-muted-foreground/15 to-transparent" />
                          <div className="space-y-2">
                            {chainSteps.map((step: any, i: number) => {
                              const label =
                                step.node ?? step.tool ?? step.type ?? `step ${i + 1}`;
                              return (
                                <div key={i} className="relative flex items-start gap-3">
                                  <div className="absolute -left-5 w-3 h-3 rounded-full bg-muted border border-muted-foreground/30 mt-0.5 shrink-0" />
                                  <div className="flex-1 rounded-lg border border-border bg-muted/15 px-3 py-2 text-xs">
                                    <p className="font-medium text-foreground/80 capitalize">{String(label).replace(/_/g, " ")}</p>
                                    {step.input && (
                                      <p className="text-muted-foreground mt-0.5 break-words font-mono text-[10px]">
                                        {String(step.input).slice(0, 120)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Simple Sparkline using SVG ───────────────────────────────────────────────

// ─── Main Component ───────────────────────────────────────────────────────────

export function ObservabilityView({ projectId }: ObservabilityViewProps) {
  const [activeTab, setActiveTab] = useState<"traces" | "analytics">("traces");

  // ── Trace list state ──
  const [traces, setTraces] = useState<LLMTrace[]>([]);
  const [totalTraces, setTotalTraces] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingTraces, setLoadingTraces] = useState(false);
  const [liveMode, setLiveMode] = useState(true);  // auto-poll toggle
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newTraceCount, setNewTraceCount] = useState(0);
  const [selectedTrace, setSelectedTrace] = useState<LLMTrace | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTotalRef = useRef(0);

  // ── Filters ──
  const [serviceFilter, setServiceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // ── Analytics state ──
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const PAGE_SIZE = 50;

  const fetchTraces = useCallback(async (silent = false) => {
    if (!silent) setLoadingTraces(true);
    try {
      const res = await getTraces({
        // Do not filter by project_id — show all traces across the platform
        // (project_id is often NULL when it isn't sent in the WS payload)
        ai_service: serviceFilter || undefined,
        status: statusFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      if (res.success && res.data) {
        const newTotal = res.data.total;
        if (silent && prevTotalRef.current > 0 && newTotal > prevTotalRef.current) {
          setNewTraceCount(newTotal - prevTotalRef.current);
        } else {
          setNewTraceCount(0);
        }
        prevTotalRef.current = newTotal;
        setTraces(res.data.items);
        setTotalTraces(newTotal);
        setLastUpdated(new Date());
      }
    } finally {
      if (!silent) setLoadingTraces(false);
    }
  }, [projectId, serviceFilter, statusFilter, dateFrom, dateTo, page]);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await getUsageAnalytics({
        // Show platform-wide analytics (project_id filter removed for same reason as traces)
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      if (res.success && res.data) setAnalytics(res.data);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [projectId, dateFrom, dateTo]);

  // Initial load
  useEffect(() => {
    if (activeTab === "traces") fetchTraces();
    else fetchAnalytics();
  }, [activeTab, fetchTraces, fetchAnalytics]);

  // Live polling — only on traces tab
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (activeTab === "traces" && liveMode) {
      pollTimerRef.current = setInterval(() => fetchTraces(true), POLL_INTERVAL_MS);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [activeTab, liveMode, fetchTraces]);

  const totalPages = Math.ceil(totalTraces / PAGE_SIZE);

  // Daily cost (all services) for the analytics chart
  const dailyCost = analytics
    ? Object.entries(
        (analytics.daily_trend ?? []).reduce<Record<string, number>>((acc, d) => {
          acc[d.day] = (acc[d.day] ?? 0) + Number(d.cost_usd || 0);
          return acc;
        }, {}),
      )
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([day, cost]) => ({ day, cost: Number(cost.toFixed(4)) }))
    : [];

  // Page-level summary for the trace explorer
  const pageStats = (() => {
    const n = traces.length || 1;
    const ok = traces.filter((t) => t.status === "success").length;
    const lat = traces.filter((t) => t.latency_ms != null);
    return {
      success: traces.length ? Math.round((ok / n) * 100) : 0,
      avgLatency: lat.length ? Math.round(lat.reduce((s, t) => s + (t.latency_ms ?? 0), 0) / lat.length) : null,
      tokens: traces.reduce((s, t) => s + (t.total_tokens || 0), 0),
      cost: traces.reduce((s, t) => s + (t.estimated_cost_usd || 0), 0),
    };
  })();

  const [traceView, setTraceView] = useState<"timeline" | "table">(() => {
    try {
      return localStorage.getItem("vizai_obs_view") === "table" ? "table" : "timeline";
    } catch {
      return "timeline";
    }
  });
  const changeTraceView = (v: "timeline" | "table") => {
    setTraceView(v);
    try {
      localStorage.setItem("vizai_obs_view", v);
    } catch {
      /* ignore */
    }
  };
  const hasFilters = Boolean(serviceFilter || statusFilter || dateFrom || dateTo);
  const summary = analytics?.summary;

  return (
    <div className="min-h-full">
      <div className="ws-page obs-page">
        {/* ── Header ── */}
        <header className="ws-header">
          <div>
            <h1 className="ws-title">AI Observability</h1>
            <p className="ws-subtitle">Every LLM call with its tokens, cost, latency and reasoning chain.</p>
          </div>
          <div className="ws-actions">
            {activeTab === "traces" && (
              <button
                type="button"
                onClick={() => setLiveMode((v) => !v)}
                aria-pressed={liveMode}
                className={`obs-live${liveMode ? " is-on" : ""}`}
                title={liveMode ? "Live updates on — click to pause" : "Live updates paused — click to resume"}
              >
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                {liveMode ? "Live" : "Paused"}
                {lastUpdated && <span className="obs-live-time">{lastUpdated.toLocaleTimeString()}</span>}
              </button>
            )}
            <button
              type="button"
              className="obs-pill-btn"
              onClick={() => activeTab === "traces" ? fetchTraces() : fetchAnalytics()}
            >
              <RefreshCw className={`w-4 h-4 ${loadingTraces || loadingAnalytics ? "animate-spin" : ""}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </header>

        {/* ── Tabs ── */}
        <div className="obs-segment" role="tablist" aria-label="Observability view">
          {(["traces", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={`obs-segment-btn${activeTab === tab ? " is-active" : ""}`}
            >
              {tab === "traces" ? <Activity className="w-4 h-4" aria-hidden="true" /> : <BarChart2 className="w-4 h-4" aria-hidden="true" />}
              {tab === "traces" ? "Trace Explorer" : "Usage Analytics"}
            </button>
          ))}
        </div>

        {/* ── Trace Explorer ── */}
        {activeTab === "traces" && (
          <section className="obs-panel">
            {/* Status tabs */}
            <div className="obs-status-tabs" role="tablist" aria-label="Filter by status">
              {[
                { id: "", label: "All" },
                { id: "success", label: "Success" },
                { id: "error", label: "Error" },
                { id: "timeout", label: "Timeout" },
              ].map((t) => (
                <button
                  key={t.id || "all"}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === t.id}
                  className={`obs-status-tab${statusFilter === t.id ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter(t.id); setPage(1); }}
                >
                  {t.label}
                </button>
              ))}
              <span className="obs-count">
                {liveMode && <span className="obs-live-dot" aria-hidden="true" />}
                {loadingTraces ? "Loading…" : `${totalTraces.toLocaleString()} traces`}
              </span>
            </div>

            {/* Filters */}
            <div className="obs-toolbar">
              <label className="obs-field">
                <span className="sr-only">Service</span>
                <select
                  value={serviceFilter}
                  onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All services</option>
                  {Object.entries(AI_SERVICE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </label>
              <label className="obs-field obs-field--date">
                <span className="obs-field-label">From</span>
                <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              </label>
              <label className="obs-field obs-field--date">
                <span className="obs-field-label">To</span>
                <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              </label>
              {hasFilters && (
                <button
                  type="button"
                  className="obs-clear"
                  onClick={() => { setServiceFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" /> Clear filters
                </button>
              )}
              <div className="obs-view-toggle" role="group" aria-label="Trace layout">
                <button
                  type="button"
                  aria-pressed={traceView === "timeline"}
                  className={traceView === "timeline" ? "is-active" : ""}
                  onClick={() => changeTraceView("timeline")}
                  title="Timeline"
                >
                  <GanttChartSquare className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">Timeline view</span>
                </button>
                <button
                  type="button"
                  aria-pressed={traceView === "table"}
                  className={traceView === "table" ? "is-active" : ""}
                  onClick={() => changeTraceView("table")}
                  title="Table"
                >
                  <Rows3 className="w-4 h-4" aria-hidden="true" />
                  <span className="sr-only">Table view</span>
                </button>
              </div>
            </div>

            {/* Page summary */}
            {traces.length > 0 && !loadingTraces && (
              <div className="obs-summary">
                <div><span>Success rate</span><strong>{pageStats.success}%</strong></div>
                <div><span>Avg latency</span><strong>{formatLatency(pageStats.avgLatency)}</strong></div>
                <div><span>Tokens</span><strong>{formatTokens(pageStats.tokens)}</strong></div>
                <div><span>Cost</span><strong>{formatCost(pageStats.cost)}</strong></div>
                <p className="obs-summary-note">For the {traces.length} calls on this page</p>
              </div>
            )}

            {/* New-traces banner */}
            {newTraceCount > 0 && (
              <button
                type="button"
                className="obs-new-banner"
                onClick={() => { setNewTraceCount(0); fetchTraces(); }}
              >
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                {newTraceCount} new trace{newTraceCount > 1 ? "s" : ""} — show them
              </button>
            )}

            {/* Body */}
            {loadingTraces ? (
              <div className="obs-loading">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="home-skel" style={{ height: 56, borderRadius: 14 }} />)}
              </div>
            ) : traces.length === 0 ? (
              <div className="ws-empty obs-empty">
                <span className="ws-empty-icon"><Activity className="w-7 h-7" aria-hidden="true" /></span>
                <p className="ws-empty-title">{hasFilters ? "No traces match these filters" : "No traces yet"}</p>
                <p className="ws-empty-text">
                  {hasFilters ? "Try a wider date range or clear the filters." : "Generate a chart or use Probe Mode and each LLM call will appear here."}
                </p>
              </div>
            ) : traceView === "timeline" ? (
              <TraceTimeline traces={traces} onSelect={setSelectedTrace} />
            ) : (
              <div className="obs-table-wrap">
                <table className="obs-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Service</th>
                      <th>Model</th>
                      <th className="text-right">Tokens</th>
                      <th className="text-right">Cost</th>
                      <th className="text-right">Latency</th>
                      <th>Status</th>
                      <th aria-label="Open" />
                    </tr>
                  </thead>
                  <tbody>
                    {traces.map((trace) => (
                      <tr key={trace.id} tabIndex={0} onClick={() => setSelectedTrace(trace)} onKeyDown={(e) => { if (e.key === "Enter") setSelectedTrace(trace); }}>
                        <td className="text-muted-foreground whitespace-nowrap">{trace.created_at ? timeAgo(trace.created_at) : "—"}</td>
                        <td><ServiceBadge service={trace.ai_service} /></td>
                        <td className="font-mono text-[13px]">{trace.model_name ?? "—"}</td>
                        <td className="text-right font-medium tabular-nums">{formatTokens(trace.total_tokens)}</td>
                        <td className="text-right tabular-nums">{formatCost(trace.estimated_cost_usd)}</td>
                        <td className="text-right tabular-nums text-muted-foreground">{formatLatency(trace.latency_ms)}</td>
                        <td><StatusBadge status={trace.status} /></td>
                        <td><ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="obs-pager">
                <span>Page {page} of {totalPages}</span>
                <div>
                  <button type="button" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button type="button" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Usage Analytics ── */}
        {activeTab === "analytics" && (
          <>
            <div className="obs-toolbar obs-toolbar--plain">
              <label className="obs-field obs-field--date">
                <span className="obs-field-label">From</span>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="obs-field obs-field--date">
                <span className="obs-field-label">To</span>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
              <button type="button" className="obs-pill-btn is-primary" onClick={fetchAnalytics}>Apply</button>
            </div>

            {loadingAnalytics ? (
              <div className="obs-stats">
                {Array.from({ length: 4 }, (_, i) => <div key={i} className="home-skel" style={{ height: 132, borderRadius: 22 }} />)}
              </div>
            ) : !analytics || !summary ? (
              <div className="ws-empty">
                <span className="ws-empty-icon"><BarChart2 className="w-7 h-7" aria-hidden="true" /></span>
                <p className="ws-empty-title">No usage data yet</p>
                <p className="ws-empty-text">Usage appears here once VizAI has made LLM calls in this period.</p>
              </div>
            ) : (
              <>
                <div className="obs-stats">
                  <StatCard
                    label="LLM calls"
                    value={(summary.total_calls ?? 0).toLocaleString()}
                    sub={`${summary.error_rate ?? 0}% error rate`}
                    icon={Zap}
                    accent
                  />
                  <StatCard
                    label="Tokens"
                    value={formatTokens(summary.total_tokens ?? 0)}
                    sub={`${formatTokens(summary.total_prompt_tokens ?? 0)} prompt · ${formatTokens(summary.total_completion_tokens ?? 0)} completion`}
                    icon={Cpu}
                  />
                  <StatCard
                    label="Estimated cost"
                    value={`$${Number(summary.total_cost_usd ?? 0).toFixed(4)}`}
                    sub="USD, all services"
                    icon={DollarSign}
                  />
                  <StatCard
                    label="Avg latency"
                    value={formatLatency(summary.avg_latency_ms ?? null)}
                    sub={`${summary.error_count ?? 0} errors`}
                    icon={Clock}
                  />
                </div>

                <div className="obs-analytics-grid">
                  {dailyCost.length > 0 && (
                    <section className="obs-card obs-card--wide">
                      <div className="obs-card-head">
                        <h3>Daily cost</h3>
                        <span>Last {dailyCost.length} days · USD</span>
                      </div>
                      <ChartCard type="area" data={dailyCost} dataKeys={["cost"]} xAxisKey="day" height={240} showLegend={false} />
                    </section>
                  )}

                  {(analytics.service_breakdown ?? []).length > 0 && (
                    <section className="obs-card">
                      <div className="obs-card-head"><h3>By service</h3></div>
                      <div className="obs-breakdown">
                        {(analytics.service_breakdown ?? []).map((row) => {
                          const totalCost = Number(summary.total_cost_usd) || 1;
                          const pct = Math.min(100, (Number(row.cost_usd) / totalCost) * 100);
                          return (
                            <div key={row.ai_service} className="obs-breakdown-row">
                              <div className="obs-breakdown-top">
                                <ServiceBadge service={row.ai_service} />
                                <span className="obs-breakdown-cost">{formatCost(Number(row.cost_usd))}</span>
                              </div>
                              <div className={`obs-meter obs-tone-${serviceTone(row.ai_service)}`}>
                                <span style={{ width: `${Math.max(pct, 2)}%` }} />
                              </div>
                              <p className="obs-breakdown-meta">
                                {row.calls.toLocaleString()} calls · {formatTokens(row.tokens)} tokens
                                {row.errors > 0 && <span className="obs-err"> · {row.errors} errors</span>}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {(analytics.model_breakdown ?? []).length > 0 && (
                    <section className="obs-card">
                      <div className="obs-card-head"><h3>By model</h3></div>
                      <table className="obs-table obs-table--compact">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th className="text-right">Calls</th>
                            <th className="text-right">Tokens</th>
                            <th className="text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(analytics.model_breakdown ?? []).map((row, i) => (
                            <tr key={i}>
                              <td>
                                <span className="font-mono text-[13px]">{row.model_name ?? "—"}</span>
                                <span className="block text-[12px] text-muted-foreground capitalize">{row.llm_provider ?? "—"}</span>
                              </td>
                              <td className="text-right tabular-nums">{row.calls.toLocaleString()}</td>
                              <td className="text-right tabular-nums">{formatTokens(row.tokens)}</td>
                              <td className="text-right tabular-nums font-semibold">{formatCost(Number(row.cost_usd))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Trace Detail Drawer */}
      {selectedTrace && (
        <TraceDetail trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
      )}
    </div>
  );
}
