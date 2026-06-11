import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, Filter, RefreshCw, ChevronRight, ChevronDown,
  CheckCircle2, XCircle, Clock, AlertTriangle, Zap, DollarSign,
  Cpu, BarChart2, ChevronLeft, X, Database, Bot, Radio
} from "lucide-react";
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

const SERVICE_COLORS: Record<string, string> = {
  chart_creation: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  probe_mode: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  ai_assistant: "bg-blue-500/15 text-blue-400 border-blue-500/30",
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: "text-green-400", label: "Success" },
  error: { icon: XCircle, color: "text-red-400", label: "Error" },
  timeout: { icon: Clock, color: "text-yellow-400", label: "Timeout" },
  cancelled: { icon: AlertTriangle, color: "text-muted-foreground", label: "Cancelled" },
};

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
    <div className={`rounded-xl border p-4 flex flex-col gap-2 ${accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
        <Icon className={`w-4 h-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <span className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ServiceBadge({ service }: { service: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SERVICE_COLORS[service] ?? SERVICE_COLORS.other}`}>
      {AI_SERVICE_LABELS[service] ?? service}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.error;
  const Icon = cfg.icon;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {cfg.label}
    </span>
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

function Sparkline({ data, color = "var(--color-primary)" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120, h = 32, pad = 2;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1 || 1)) * (w - pad * 2);
    const y = pad + ((1 - (v - min) / range) * (h - pad * 2));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

  // Build daily cost sparkline from analytics
  const dailyCostData = analytics
    ? [...analytics.daily_trend]
        .sort((a, b) => a.day.localeCompare(b.day))
        .slice(-14)
        .map((d) => Number(d.cost_usd))
    : [];

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">AI Observability</h1>
              <p className="text-xs text-muted-foreground">Trace every LLM call — tokens, cost, reasoning chain</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Live indicator — only shown on traces tab */}
            {activeTab === "traces" && (
              <button
                onClick={() => setLiveMode((v) => !v)}
                title={liveMode ? "Live mode ON — click to pause" : "Live mode OFF — click to enable"}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                  liveMode
                    ? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <Radio className={`w-3 h-3 ${liveMode ? "animate-pulse" : ""}`} />
                {liveMode ? "Live" : "Paused"}
              </button>
            )}
            {lastUpdated && activeTab === "traces" && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => activeTab === "traces" ? fetchTraces() : fetchAnalytics()}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border hover:bg-muted/40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTraces || loadingAnalytics ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4">
          {(["traces", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm rounded-lg transition-colors capitalize font-medium ${
                activeTab === tab
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              {tab === "traces" ? "Trace Explorer" : "Usage Analytics"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trace Explorer ──────────────────────────────────────────────── */}
      {activeTab === "traces" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters */}
          <div className="px-6 py-3 border-b border-border flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

            <select
              value={serviceFilter}
              onChange={(e) => { setServiceFilter(e.target.value); setPage(1); }}
              className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">All Services</option>
              {Object.entries(AI_SERVICE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
              <option value="timeout">Timeout</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="From"
            />
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              placeholder="To"
            />

            {(serviceFilter || statusFilter || dateFrom || dateTo) && (
              <button
                onClick={() => { setServiceFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}

            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
              {liveMode && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
              {loadingTraces ? "Loading…" : `${totalTraces.toLocaleString()} traces`}
            </span>
          </div>

          {/* New-traces banner */}
          {newTraceCount > 0 && (
            <button
              className="w-full py-2 text-xs font-medium bg-green-500/10 border-b border-green-500/20 text-green-400 hover:bg-green-500/15 transition-colors flex items-center justify-center gap-2"
              onClick={() => { setNewTraceCount(0); fetchTraces(); }}
            >
              <Radio className="w-3 h-3 animate-pulse" />
              {newTraceCount} new trace{newTraceCount > 1 ? "s" : ""} — click to reload
            </button>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto">
            {loadingTraces ? (
              <div className="flex items-center justify-center h-40">
                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : traces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
                <Activity className="w-8 h-8 opacity-30" />
                <p className="text-sm">No traces found. Start using Probe Mode to see LLM traces here.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background/95 backdrop-blur border-b border-border">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Model</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Tokens</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Cost</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Latency</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {traces.map((trace) => (
                    <tr
                      key={trace.id}
                      className="hover:bg-muted/20 cursor-pointer transition-colors group"
                      onClick={() => setSelectedTrace(trace)}
                    >
                      <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                        {trace.created_at ? timeAgo(trace.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <ServiceBadge service={trace.ai_service} />
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono text-xs">
                        {trace.model_name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground font-medium">
                        {formatTokens(trace.total_tokens)}
                      </td>
                      <td className="px-4 py-3 text-right text-foreground">
                        {formatCost(trace.estimated_cost_usd)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {trace.latency_ms != null ? `${trace.latency_ms}ms` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={trace.status} />
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Usage Analytics ─────────────────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Date filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-sm bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              Apply
            </button>
          </div>

          {loadingAnalytics ? (
            <div className="flex items-center justify-center h-40">
              <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !analytics ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-3">
              <BarChart2 className="w-8 h-8 opacity-30" />
              <p className="text-sm">No analytics data yet.</p>
            </div>
          ) : (
            <>
              {/* Summary stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="Total LLM Calls"
                  value={analytics.summary.total_calls.toLocaleString()}
                  sub={`${analytics.summary.error_rate}% error rate`}
                  icon={Zap}
                  accent
                />
                <StatCard
                  label="Total Tokens"
                  value={formatTokens(analytics.summary.total_tokens)}
                  sub={`${formatTokens(analytics.summary.total_prompt_tokens)} prompt / ${formatTokens(analytics.summary.total_completion_tokens)} completion`}
                  icon={Cpu}
                />
                <StatCard
                  label="Est. Total Cost"
                  value={`$${analytics.summary.total_cost_usd.toFixed(4)}`}
                  sub="USD across all services"
                  icon={DollarSign}
                />
                <StatCard
                  label="Avg Latency"
                  value={`${analytics.summary.avg_latency_ms}ms`}
                  sub={`${analytics.summary.error_count} errors`}
                  icon={Clock}
                />
              </div>

              {/* Cost sparkline + per-day table */}
              {analytics.daily_trend.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground">Daily Cost Trend (last 14 days)</h3>
                    <Sparkline data={dailyCostData} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                          <th className="text-left py-2 text-muted-foreground font-medium">Service</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Calls</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Tokens</th>
                          <th className="text-right py-2 text-muted-foreground font-medium">Cost (USD)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {[...analytics.daily_trend]
                          .sort((a, b) => b.day.localeCompare(a.day))
                          .slice(0, 30)
                          .map((row, i) => (
                            <tr key={i} className="hover:bg-muted/10">
                              <td className="py-2 text-muted-foreground font-mono">{row.day}</td>
                              <td className="py-2"><ServiceBadge service={row.ai_service} /></td>
                              <td className="py-2 text-right text-foreground">{row.calls.toLocaleString()}</td>
                              <td className="py-2 text-right text-foreground">{formatTokens(row.tokens)}</td>
                              <td className="py-2 text-right font-medium text-foreground">{formatCost(Number(row.cost_usd))}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Service breakdown */}
              {analytics.service_breakdown.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Breakdown by AI Service</h3>
                  <div className="space-y-3">
                    {analytics.service_breakdown.map((row) => {
                      const totalCost = analytics.summary.total_cost_usd || 1;
                      const pct = Math.min(100, (Number(row.cost_usd) / totalCost) * 100);
                      return (
                        <div key={row.ai_service}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <ServiceBadge service={row.ai_service} />
                              <span className="text-xs text-muted-foreground">{row.calls.toLocaleString()} calls</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-muted-foreground">{formatTokens(row.tokens)} tokens</span>
                              <span className="font-semibold text-foreground">{formatCost(Number(row.cost_usd))}</span>
                              {row.errors > 0 && (
                                <span className="text-red-400">{row.errors} errors</span>
                              )}
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary/60 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Model breakdown */}
              {analytics.model_breakdown.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Breakdown by Model</h3>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Model</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Provider</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Calls</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Tokens</th>
                        <th className="text-right py-2 text-muted-foreground font-medium">Cost (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {analytics.model_breakdown.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/10">
                          <td className="py-2 font-mono text-foreground">{row.model_name ?? "—"}</td>
                          <td className="py-2 capitalize text-muted-foreground">{row.llm_provider ?? "—"}</td>
                          <td className="py-2 text-right text-foreground">{row.calls.toLocaleString()}</td>
                          <td className="py-2 text-right text-foreground">{formatTokens(row.tokens)}</td>
                          <td className="py-2 text-right font-semibold text-foreground">{formatCost(Number(row.cost_usd))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Trace Detail Drawer */}
      {selectedTrace && (
        <TraceDetail trace={selectedTrace} onClose={() => setSelectedTrace(null)} />
      )}
    </div>
  );
}
