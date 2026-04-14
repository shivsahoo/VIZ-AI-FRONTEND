import * as React from "react";
import { Send, Loader2, Bot, User, CheckCircle2, Microscope, LayoutDashboard, ChevronDown, Code2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Button } from "../../ui/button";
import { GradientButton } from "../../shared/GradientButton";
import { Badge } from "../../ui/badge";
import { ChartCard } from "./ChartCard";
import { toast } from "sonner";
import {
  getChartData,
  addChartToDashboard,
  createChart,
  getCurrentUser,
  type Chart as SavedChart,
} from "../../../services/api";
import {
  inferChartDataConfig,
  getDefaultChartDataConfig,
  inferExtendedChartConfig,
  extendedToChartDataConfig,
  isExtendedChartType,
  mapApiAxisConfigToChart,
  type ChartDataConfig,
} from "../../../utils/chartData";
import type { ChartAxisConfig, ChartType } from "./core/chartTypes";
import { VizAIWebSocket, type ChartSpec } from "../../../services/websocket";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

function normalizeProbeChartType(t: string | undefined): ChartType {
  const s = (t ?? "bar").toLowerCase();
  const allowed: ChartType[] = [
    "line",
    "bar",
    "area",
    "pie",
    "scatter",
    "heatmap",
    "funnel",
    "map",
  ];
  return (allowed.includes(s as ChartType) ? s : "bar") as ChartType;
}

function buildChartPreviewConfig(
  rows: any[],
  typeStr: string,
  xHint: string | undefined,
  yHint: string | undefined,
  apiAxis: unknown,
): {
  config: ChartDataConfig;
  axisConfig: ChartAxisConfig;
  /** Effective renderer type after `inferExtendedChartConfig` (e.g. bar fallback for degenerate scatter). */
  effectiveChartType?: ChartType;
} {
  if (!rows.length) {
    return { config: getDefaultChartDataConfig(), axisConfig: {} };
  }

  const baseAxis: ChartAxisConfig = {
    ...mapApiAxisConfigToChart(apiAxis),
  };
  if (xHint) baseAxis.xAxisKey = baseAxis.xAxisKey ?? xHint;
  if (yHint) baseAxis.yAxisKey = baseAxis.yAxisKey ?? yHint;

  const resolved = normalizeProbeChartType(typeStr);

  if (isExtendedChartType(resolved)) {
    const ext = inferExtendedChartConfig(rows, resolved, baseAxis);
    return {
      config: extendedToChartDataConfig(ext),
      axisConfig: ext.axisConfig,
      effectiveChartType: ext.fallbackType ?? resolved,
    };
  }

  const legacy = resolved as "bar" | "line" | "pie" | "area";

  if (xHint && yHint) {
    if (legacy === "pie") {
      return {
        config: {
          data: rows.map((r) => ({
            name: r[xHint] ?? "",
            value: Number(r[yHint]) || 0,
          })),
          dataKeys: { primary: "value" },
          xAxisKey: "name",
        },
        axisConfig: baseAxis,
      };
    }
    return {
      config: {
        data: rows,
        dataKeys: { primary: yHint },
        xAxisKey: xHint,
      },
      axisConfig: baseAxis,
    };
  }

  return {
    config: inferChartDataConfig(rows, legacy),
    axisConfig: {},
  };
}

interface ProbeMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Present when the assistant returned a modified SQL query or chart-type change */
  modifiedSql?: string;
  /** New chart type if the agent suggested a type conversion */
  modifiedChartType?: string;
  /** Pre-fetched chart data for the modified query */
  chartPreview?: {
    config: ChartDataConfig;
    axisConfig?: ChartAxisConfig;
    spec: Partial<ChartSpec>;
    isLoading: boolean;
    error?: string;
    effectiveChartType?: ChartType;
  };
  /** Resolved visualization type for this preview (kept when only SQL changes after a type switch) */
  previewChartType?: ChartType;
  /** Name of dashboard this was saved to */
  savedToDashboard?: string;
  /** User saved this variant as a project draft */
  savedAsDraft?: boolean;
}

interface ProbeModeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The chart being probed — carries all the context we send to the backend */
  chart: {
    name: string;
    type: string;
    query?: string;
    spec?: ChartSpec;
    dataConnectionId?: string;
    databaseId?: string;
    db_schema?: string;
    db_type?: string;
  } | null;
  /** Available dashboards for "Save to Dashboard" */
  dashboards?: Array<{ id: string | number; name: string }>;
  /** Required for "Save for later" (same as chart preview flow) */
  projectId?: string | number;
  onSaveAsDraft?: (savedChart?: SavedChart) => void;
  onApplyChanges?: (modifiedSql: string, modifiedSpec?: Partial<ChartSpec>) => void;
}

// ---------------------------------------------------------------------------
// Collapsible SQL preview (collapsed by default per message)
// ---------------------------------------------------------------------------

function CollapsibleModifiedQuery({ sql }: { sql: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 min-w-0">
          <Code2 className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span className="truncate">Generated query</span>
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs shrink-0 gap-1 px-2.5"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Hide" : "Expand"}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </Button>
      </div>
      {open ? (
        <div className="px-3 py-2">
          <pre className="text-xs text-foreground/80 bg-muted/50 rounded-lg p-2 overflow-x-auto overflow-y-auto whitespace-pre-wrap max-h-56 border border-border/60">
            <code>{sql}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight inline-markdown renderer
// Handles: **bold**, *italic*, `code`
// ---------------------------------------------------------------------------

function renderMarkdown(text: string): React.ReactNode[] {
  // Split on **bold**, *italic*, `code` — order matters (bold before italic)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-muted/70 rounded px-1 py-0.5 text-[0.8em] font-mono"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProbeModeDialog({
  isOpen,
  onClose,
  chart,
  dashboards = [],
  projectId,
  onSaveAsDraft,
  onApplyChanges: _onApplyChanges,
}: ProbeModeDialogProps) {
  const [messages, setMessages] = React.useState<ProbeMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);
  // Tracks which message is currently being saved (msgId → true)
  const [savingMap, setSavingMap] = React.useState<Record<number, boolean>>({});
  const [draftSavingMap, setDraftSavingMap] = React.useState<Record<number, boolean>>({});

  // Each probe session gets its own WS connection → its own LangGraph thread_id
  const wsRef = React.useRef<VizAIWebSocket | null>(null);
  const isFirstMessageRef = React.useRef(true);
  /** Synced with the last successful probe result so follow-up turns send authoritative SQL/type to the backend */
  const workingSqlRef = React.useRef("");
  const workingChartTypeRef = React.useRef("bar");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const messageIdRef = React.useRef(0);

  const nextId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  // Auto-scroll to latest message or thinking indicator
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Establish a fresh WS connection every time the dialog opens
  React.useEffect(() => {
    if (!isOpen || !chart) return;

    let cancelled = false;

    const connect = async () => {
      setIsConnecting(true);
      setMessages([]);
      isFirstMessageRef.current = true;
      messageIdRef.current = 0;
      workingSqlRef.current = chart?.query ?? "";
      workingChartTypeRef.current = chart?.type ?? "bar";

      try {
        const userResp = await getCurrentUser();
        if (cancelled) return;

        const userId = userResp.data?.id?.toString() ?? "anonymous";
        const ws = new VizAIWebSocket(userId);
        wsRef.current = ws;

        ws.on("probe_mode", (response) => {
          if (cancelled) return;

          const priorSql = workingSqlRef.current;
          const priorChartType = workingChartTypeRef.current;

          if (response.status === "error") {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                content: response.error || response.message || "Something went wrong.",
              },
            ]);
            setIsLoading(false);
            return;
          }

          const state = response.state ?? {};
          const responseType: string = state.response_type ?? "conversational";
          const explanation: string = state.explanation || response.message || "";
          const modifiedSql: string | undefined = state.modified_sql ?? undefined;
          const modifiedChartType: string | undefined = state.modified_chart_type ?? undefined;
          const modifiedSpec: Partial<ChartSpec> | undefined =
            state.modified_chart_spec ?? undefined;
          // Rows + axis hints from the LLM service (tabular format)
          const queryData: any[] | undefined =
            Array.isArray(state.query_data) && state.query_data.length > 0
              ? state.query_data
              : undefined;
          const queryXAxis: string | undefined = state.query_x_axis ?? undefined;
          const queryYAxis: string | undefined = state.query_y_axis ?? undefined;
          const axisPayload: unknown = state.axis_config;

          // Show a visual preview when SQL changed OR when chart type changed
          const hasVisualChange =
            (responseType === "modify_query" && modifiedSql) ||
            (responseType === "modify_chart_type" && modifiedChartType);

          const explanationTrimmed = explanation.trim();
          const assistantText =
            explanationTrimmed ||
            (hasVisualChange
              ? "Here's an updated chart based on your request."
              : "I've processed your request. Ask a follow-up if you'd like to go deeper.");

          const newMsg: ProbeMessage = {
            id: nextId(),
            role: "assistant",
            content: assistantText,
            modifiedSql: hasVisualChange
              ? (modifiedSql ?? priorSql) || chart.query || ""
              : undefined,
            modifiedChartType: hasVisualChange ? modifiedChartType : undefined,
          };

          if (hasVisualChange) {
            const resolvedType = normalizeProbeChartType(
              modifiedChartType ??
                (priorChartType === "pie" ? "bar" : priorChartType) ??
                (chart.type === "pie" ? "bar" : chart.type) ??
                "bar",
            );
            newMsg.previewChartType = resolvedType;

            if (queryData) {
              // ── Fast path: LLM service already executed the query ──────────
              const built = buildChartPreviewConfig(
                queryData,
                resolvedType,
                queryXAxis,
                queryYAxis,
                axisPayload,
              );
              newMsg.chartPreview = {
                config: built.config,
                axisConfig: built.axisConfig,
                spec: modifiedSpec ?? {},
                isLoading: false,
                effectiveChartType: built.effectiveChartType,
              };
              setMessages((prev) => [...prev, newMsg]);
              setIsLoading(false);
            } else {
              const sqlToRun = modifiedSql ?? priorSql ?? chart.query ?? "";
              newMsg.chartPreview = {
                config: getDefaultChartDataConfig(),
                spec: modifiedSpec ?? {},
                isLoading: true,
              };
              setMessages((prev) => [...prev, newMsg]);
              setIsLoading(false);

              const connectionId = chart.dataConnectionId || chart.databaseId || "";
              // Send response_format=tabular so all columns are returned
              getChartData("probe-preview", connectionId, sqlToRun, undefined, undefined, false)
                .then((res) => {
                  if (cancelled) return;
                  const built =
                    res.success && res.data
                      ? buildChartPreviewConfig(
                          res.data.data,
                          resolvedType,
                          res.data.metadata?.xAxis ?? undefined,
                          res.data.metadata?.yAxis ?? undefined,
                          axisPayload,
                        )
                      : {
                          config: getDefaultChartDataConfig(),
                          axisConfig: {} as ChartAxisConfig,
                          effectiveChartType: undefined as ChartType | undefined,
                        };
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === newMsg.id
                        ? {
                            ...m,
                            chartPreview: {
                              config: built.config,
                              axisConfig: built.axisConfig,
                              spec: modifiedSpec ?? {},
                              isLoading: false,
                              error: res.success ? undefined : res.error?.message,
                              effectiveChartType: built.effectiveChartType,
                            },
                          }
                        : m
                    )
                  );
                })
                .catch(() => {
                  if (cancelled) return;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === newMsg.id
                        ? {
                            ...m,
                            chartPreview: {
                              ...m.chartPreview!,
                              isLoading: false,
                              error: "Could not fetch preview data.",
                            },
                          }
                        : m
                    )
                  );
                });
            }
          } else {
            setMessages((prev) => [...prev, newMsg]);
            setIsLoading(false);
          }

          if (response.status !== "error") {
            if (modifiedSql) workingSqlRef.current = modifiedSql;
            if (modifiedChartType) workingChartTypeRef.current = modifiedChartType;
          }
        });

        await ws.connect();
        if (cancelled) { ws.disconnect(); return; }

        setIsConnecting(false);

        // Welcome message — purely local, no WS round-trip
        setMessages([
          {
            id: nextId(),
            role: "assistant",
            content: `I'm ready to help you explore **${chart.name}** deeper. Ask me to modify the query, add or remove columns, apply filters, or explain the data.`,
          },
        ]);

        // Focus the input after connecting
        setTimeout(() => inputRef.current?.focus(), 100);
      } catch {
        if (!cancelled) {
          setIsConnecting(false);
          setMessages([
            {
              id: nextId(),
              role: "assistant",
              content: "Could not connect to the AI service. Please close and try again.",
            },
          ]);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.disconnect();
      wsRef.current = null;
    };
  }, [isOpen, chart?.name]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !wsRef.current?.isConnected()) return;

    const userMsg: ProbeMessage = { id: nextId(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const connectionId = chart?.dataConnectionId || chart?.databaseId || "";

    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      wsRef.current.probeMode({
        user_message: trimmed,
        is_first_message: true,
        data_connection_id: connectionId,
        original_query: chart?.query ?? "",
        original_chart_title: chart?.name ?? "",
        original_chart_type: chart?.type ?? "bar",
        original_chart_spec: chart?.spec,
        db_schema: chart?.db_schema ?? "",
        db_type: (chart?.db_type ?? "postgres") as
          | "mysql" | "postgres" | "sqlite" | "oracledb" | "salesforce",
        current_working_sql: workingSqlRef.current,
        current_chart_type: workingChartTypeRef.current,
      });
    } else {
      // Always send data_connection_id so the backend can execute the query
      wsRef.current.probeMode({
        user_message: trimmed,
        is_first_message: false,
        data_connection_id: connectionId,
        current_working_sql: workingSqlRef.current,
        current_chart_type: workingChartTypeRef.current,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveToDashboard = async (
    msg: ProbeMessage,
    dashboardId: string | number,
    dashboardName: string,
  ) => {
    if (!chart || !msg.modifiedSql) return;

    const connectionId = chart.dataConnectionId || chart.databaseId || "";
    if (!connectionId) {
      toast.error("No database connection found for this chart.");
      return;
    }

    setSavingMap((prev) => ({ ...prev, [msg.id]: true }));

    try {
      const chartType = normalizeProbeChartType(
        msg.previewChartType ?? msg.modifiedChartType ?? chart.type ?? "bar",
      );

      const response = await addChartToDashboard({
        title: chart.name,
        query: msg.modifiedSql,
        chart_type: chartType,
        type: chartType,
        dashboard_id: String(dashboardId),
        data_connection_id: connectionId,
        report: msg.content,
      });

      if (response.success) {
        toast.success(`Chart saved to "${dashboardName}"!`);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, savedToDashboard: dashboardName } : m
          )
        );
      } else {
        toast.error("Failed to save chart to dashboard.");
      }
    } catch {
      toast.error("An error occurred while saving the chart.");
    } finally {
      setSavingMap((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  const handleSaveAsDraft = async (msg: ProbeMessage) => {
    if (!chart || !msg.modifiedSql || !projectId) {
      toast.error("Chart or project information is missing");
      return;
    }

    const connectionId = chart.dataConnectionId || chart.databaseId || "";
    if (!connectionId) {
      toast.error("No database connection found for this chart.");
      return;
    }

    if (draftSavingMap[msg.id]) return;

    const chartType = normalizeProbeChartType(
      msg.previewChartType ?? msg.modifiedChartType ?? chart.type ?? "bar",
    );

    const xAxis =
      msg.chartPreview?.config.xAxisKey ??
      msg.chartPreview?.spec?.x_axis ??
      undefined;
    const yAxis =
      msg.chartPreview?.config.dataKeys?.primary ??
      msg.chartPreview?.spec?.y_axis ??
      undefined;

    const isTimeBased =
      chart.spec?.type === "time_series"
        ? true
        : chart.spec?.type === "aggregate"
          ? false
          : msg.chartPreview?.spec?.type === "time_series"
            ? true
            : msg.chartPreview?.spec?.type === "aggregate"
              ? false
              : chart.spec?.is_time_based ?? false;

    setDraftSavingMap((prev) => ({ ...prev, [msg.id]: true }));
    try {
      const response = await createChart(String(projectId), {
        name: chart.name,
        type: chartType,
        query: msg.modifiedSql,
        databaseId: connectionId,
        is_time_based: isTimeBased,
        config: {
          xAxis: xAxis || undefined,
          yAxis: yAxis || undefined,
        },
      });

      if (response.success && response.data) {
        toast.success(`Chart "${chart.name}" saved as draft!`);
        onSaveAsDraft?.(response.data);
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, savedAsDraft: true } : m))
        );
      } else {
        toast.error(response.error?.message || "Failed to save chart as draft");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "An error occurred while saving the chart.";
      toast.error(message);
    } finally {
      setDraftSavingMap((prev) => ({ ...prev, [msg.id]: false }));
    }
  };

  if (!chart) return null;

  const canSend =
    input.trim().length > 0 &&
    !isLoading &&
    !isConnecting &&
    (wsRef.current?.isConnected() ?? false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="!max-w-none border-primary/15 p-0 gap-0 ring-1 ring-primary/25"
        style={{
          height: "72vh",
          width: "min(88vw, 1280px)",
          maxWidth: "min(88vw, 1280px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow:
            "0 0 0 1px color-mix(in oklab, var(--primary) 22%, transparent), 0 24px 48px -12px rgb(0 0 0 / 0.45), 0 0 56px -8px color-mix(in oklab, var(--primary) 38%, transparent)",
        }}
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <DialogHeader
          className="px-4 pt-4 pb-3 border-b border-border"
          style={{ flexShrink: 0 }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">
                Probe Mode
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Exploring:{" "}
                <span className="font-medium text-foreground">{chart.name}</span>
              </p>
            </div>
            <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
              {chart.type} Chart
            </Badge>
          </div>
        </DialogHeader>

        {/* ── Messages (scrollable) ──────────────────────────────────────── */}
        <div
          style={{
            flex: "1 1 0px",
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          <div className="px-4 py-3 space-y-4">

            {isConnecting && (
              <div className="flex items-center gap-2 text-muted-foreground text-xs py-4 justify-center">
                <Loader2 className="w-4 h-4 animate-spin" />
                Connecting to AI…
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    msg.role === "assistant"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Bot className="w-3.5 h-3.5" />
                  ) : (
                    <User className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`flex-1 max-w-[85%] space-y-2 flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`rounded-xl px-3 py-2 text-sm leading-relaxed break-words ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-foreground rounded-tl-none"
                    }`}
                  >
                    {msg.role === "user"
                      ? msg.content
                      : (msg.content.trim()
                          ? msg.content.split("\n").map((line, li) => (
                              <React.Fragment key={li}>
                                {li > 0 && <br />}
                                {renderMarkdown(line)}
                              </React.Fragment>
                            ))
                          : (
                              <span className="text-muted-foreground italic text-xs">
                                (No text reply — see chart or query below if shown.)
                              </span>
                            ))}
                  </div>

                  {/* Chart preview */}
                  {msg.role === "assistant" && msg.modifiedSql && (
                    <div className="w-full rounded-xl border border-border bg-background/60 overflow-hidden">
                      <CollapsibleModifiedQuery sql={msg.modifiedSql} />

                      {/* Chart — use bar for modified SQL previews unless an explicit
                          chart-type was requested; pie with 50+ slices is unreadable */}
                      <div className="p-3">
                        {msg.chartPreview?.isLoading ? (
                          <div className="flex items-center justify-center gap-2 h-36 text-muted-foreground text-xs">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Fetching data…
                          </div>
                        ) : msg.chartPreview?.error ? (
                          <div className="flex items-center justify-center h-36 text-xs text-muted-foreground text-center px-4">
                            <span>{msg.chartPreview.error}</span>
                          </div>
                        ) : (msg.chartPreview?.config.data.length ?? 0) === 0 ? (
                          <div className="flex items-center justify-center h-36 text-xs text-muted-foreground">
                            No data returned for this query.
                          </div>
                        ) : (
                          <ChartCard
                            type={normalizeProbeChartType(
                              msg.chartPreview?.effectiveChartType ??
                                msg.previewChartType ??
                                msg.modifiedChartType ??
                                (chart.type === "pie" ? "bar" : chart.type) ??
                                "bar",
                            )}
                            data={msg.chartPreview!.config.data}
                            dataKeys={[
                              msg.chartPreview!.config.dataKeys.primary,
                              ...(msg.chartPreview!.config.dataKeys.secondary
                                ? [msg.chartPreview!.config.dataKeys.secondary]
                                : []),
                            ]}
                            xAxisKey={msg.chartPreview!.config.xAxisKey}
                            axisConfig={msg.chartPreview?.axisConfig}
                            showLegend
                            height={200}
                          />
                        )}
                      </div>

                      {/* Save for later + Save to Dashboard (same pattern as chart preview) */}
                      <div className="px-3 pb-3 pt-1">
                        {msg.savedToDashboard ? (
                          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Saved to &ldquo;{msg.savedToDashboard}&rdquo;
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 items-center">
                            {msg.savedAsDraft && (
                              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 w-full sm:w-auto">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Saved as draft
                              </div>
                            )}
                            {projectId && !msg.savedAsDraft && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 flex-1 min-w-[7rem] sm:flex-initial"
                                disabled={
                                  !!msg.chartPreview?.isLoading ||
                                  !!savingMap[msg.id] ||
                                  !!draftSavingMap[msg.id]
                                }
                                onClick={() => handleSaveAsDraft(msg)}
                              >
                                {draftSavingMap[msg.id] ? (
                                  <span className="flex items-center gap-1.5">
                                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                    Saving...
                                  </span>
                                ) : (
                                  "Save for later"
                                )}
                              </Button>
                            )}
                            {dashboards.length > 0 ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <GradientButton
                                    size="sm"
                                    className="text-xs h-7 gap-1.5 flex-1 min-w-[9rem] sm:flex-initial"
                                    disabled={
                                      !!msg.chartPreview?.isLoading ||
                                      !!msg.chartPreview?.error ||
                                      !!savingMap[msg.id] ||
                                      !!draftSavingMap[msg.id]
                                    }
                                  >
                                    {savingMap[msg.id] ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <LayoutDashboard className="w-3 h-3" />
                                    )}
                                    Save to Dashboard
                                    <ChevronDown className="w-3 h-3" />
                                  </GradientButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-52">
                                  <DropdownMenuLabel className="text-xs">
                                    Choose a dashboard
                                  </DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {dashboards.map((db) => (
                                    <DropdownMenuItem
                                      key={db.id}
                                      className="text-xs cursor-pointer"
                                      onClick={() =>
                                        handleSaveToDashboard(msg, db.id, db.name)
                                      }
                                    >
                                      <LayoutDashboard className="w-3.5 h-3.5 mr-2 opacity-60" />
                                      {db.name}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                No dashboards available
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Thinking / typing indicator while the model responds */}
            {isLoading && !isConnecting && (
              <div className="flex gap-2.5" aria-live="polite" aria-busy="true">
                <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5 ring-1 ring-primary/30 shadow-md glow">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="rounded-xl rounded-tl-none border border-primary/30 bg-muted/85 px-3 py-2 shadow-md glow min-w-[6.5rem] transition-shadow duration-300">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold tracking-tight text-foreground"
                      style={{
                        textShadow:
                          "0 0 12px color-mix(in oklab, var(--primary) 55%, transparent), 0 0 20px color-mix(in oklab, var(--primary) 25%, transparent)",
                      }}
                    >
                      Thinking
                    </span>
                    <span className="flex items-center gap-1 pl-0.5" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_color-mix(in_oklab,var(--primary)_70%,transparent)] animate-bounce"
                          style={{ animationDuration: "0.55s", animationDelay: `${i * 140}ms` }}
                        />
                      ))}
                      <span
                        className="ml-0.5 inline-block h-3 w-0.5 rounded-sm bg-primary shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_80%,transparent)] animate-pulse"
                        style={{ animationDuration: "0.9s" }}
                      />
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input (always pinned to bottom) ───────────────────────────── */}
        <div
          className="border-t border-border px-4 py-2 bg-background"
          style={{ flexShrink: 0 }}
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isConnecting
                  ? "Connecting…"
                  : "Ask something about this chart… (Enter to send)"
              }
              disabled={isConnecting || isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 min-h-[34px] max-h-[72px] leading-snug"
              style={{ height: "34px" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                const cap = 72;
                t.style.height = "34px";
                t.style.height = `${Math.min(t.scrollHeight, cap)}px`;
              }}
            />
            <GradientButton
              size="sm"
              className="h-[34px] w-[34px] p-0 flex-shrink-0 rounded-xl"
              onClick={handleSend}
              disabled={!canSend}
            >
              <Send className="w-4 h-4" />
            </GradientButton>
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            Shift + Enter for new line
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}