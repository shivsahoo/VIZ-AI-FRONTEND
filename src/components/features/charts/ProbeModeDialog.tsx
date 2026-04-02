import * as React from "react";
import { Send, Loader2, Bot, User, CheckCircle2, X, Microscope } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { GradientButton } from "../../shared/GradientButton";
import { Badge } from "../../ui/badge";
import { ScrollArea } from "../../ui/scroll-area";
import { ChartCard } from "./ChartCard";
import { toast } from "sonner";
import { getChartData } from "../../../services/api";
import { inferChartDataConfig, getDefaultChartDataConfig, type ChartDataConfig } from "../../../utils/chartData";
import { VizAIWebSocket, type ChartSpec } from "../../../services/websocket";
import { getCurrentUser } from "../../../services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProbeMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Present when the assistant returned a modified SQL query */
  modifiedSql?: string;
  /** Pre-fetched chart data for the modified query */
  chartPreview?: {
    config: ChartDataConfig;
    spec: Partial<ChartSpec>;
    isLoading: boolean;
    error?: string;
  };
  /** Whether the user has already applied this suggestion */
  applied?: boolean;
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
  /** Called when the user applies a modified SQL so the preview can refresh */
  onApplyChanges: (modifiedSql: string, modifiedSpec?: Partial<ChartSpec>) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProbeModeDialog({
  isOpen,
  onClose,
  chart,
  onApplyChanges,
}: ProbeModeDialogProps) {
  const [messages, setMessages] = React.useState<ProbeMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [isConnecting, setIsConnecting] = React.useState(false);

  // Each probe session gets its own WS connection → its own LangGraph thread_id
  const wsRef = React.useRef<VizAIWebSocket | null>(null);
  const isFirstMessageRef = React.useRef(true);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const messageIdRef = React.useRef(0);

  const nextId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  // Auto-scroll to latest message
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Establish a fresh WS connection every time the dialog opens
  React.useEffect(() => {
    if (!isOpen || !chart) return;

    let cancelled = false;

    const connect = async () => {
      setIsConnecting(true);
      setMessages([]);
      isFirstMessageRef.current = true;
      messageIdRef.current = 0;

      try {
        const userResp = await getCurrentUser();
        if (cancelled) return;

        const userId = userResp.data?.id?.toString() ?? "anonymous";
        const ws = new VizAIWebSocket(userId);
        wsRef.current = ws;

        ws.on("probe_mode", (response) => {
          if (cancelled) return;
          setIsLoading(false);

          if (response.status === "error") {
            setMessages((prev) => [
              ...prev,
              {
                id: nextId(),
                role: "assistant",
                content: response.error || response.message || "Something went wrong.",
              },
            ]);
            return;
          }

          const state = response.state ?? {};
          const responseType: string = state.response_type ?? "conversational";
          const explanation: string = state.explanation || response.message || "";
          const modifiedSql: string | undefined = state.modified_sql ?? undefined;
          const modifiedSpec: Partial<ChartSpec> | undefined =
            state.modified_chart_spec ?? undefined;

          const newMsg: ProbeMessage = {
            id: nextId(),
            role: "assistant",
            content: explanation,
            modifiedSql: responseType === "modify_query" ? modifiedSql : undefined,
          };

          if (responseType === "modify_query" && modifiedSql) {
            // Set loading placeholder then fetch data
            newMsg.chartPreview = {
              config: getDefaultChartDataConfig(),
              spec: modifiedSpec ?? {},
              isLoading: true,
            };

            setMessages((prev) => [...prev, newMsg]);

            const connectionId =
              chart.dataConnectionId || chart.databaseId || "";

            getChartData("probe-preview", connectionId, modifiedSql)
              .then((res) => {
                if (cancelled) return;
                const config =
                  res.success && res.data
                    ? inferChartDataConfig(
                        res.data.data,
                        (chart.type ?? "bar") as "bar" | "line" | "pie" | "area"
                      )
                    : getDefaultChartDataConfig();

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === newMsg.id
                      ? {
                          ...m,
                          chartPreview: {
                            config,
                            spec: modifiedSpec ?? {},
                            isLoading: false,
                            error: res.success ? undefined : res.error?.message,
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
          } else {
            setMessages((prev) => [...prev, newMsg]);
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

    if (isFirstMessageRef.current) {
      isFirstMessageRef.current = false;
      wsRef.current.probeMode({
        user_message: trimmed,
        is_first_message: true,
        original_query: chart?.query ?? "",
        original_chart_title: chart?.name ?? "",
        original_chart_type: chart?.type ?? "bar",
        original_chart_spec: chart?.spec,
        data_connection_id: chart?.dataConnectionId || chart?.databaseId || "",
        db_schema: chart?.db_schema ?? "",
        db_type: (chart?.db_type ?? "postgres") as
          | "mysql" | "postgres" | "sqlite" | "oracledb" | "salesforce",
      });
    } else {
      wsRef.current.probeMode({
        user_message: trimmed,
        is_first_message: false,
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApply = (msg: ProbeMessage) => {
    if (!msg.modifiedSql) return;
    onApplyChanges(msg.modifiedSql, msg.chartPreview?.spec);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, applied: true } : m))
    );
    toast.success("Changes applied to chart preview!");
  };

  if (!chart) return null;

  const canSend =
    input.trim().length > 0 &&
    !isLoading &&
    !isConnecting &&
    (wsRef.current?.isConnected() ?? false);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="!w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] sm:!w-[90vw] sm:!max-w-[90vw] md:!max-w-2xl lg:!max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">

        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Microscope className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">
                Probe Mode
              </DialogTitle>
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                Exploring: <span className="font-medium text-foreground">{chart.name}</span>
              </p>
            </div>
            <Badge variant="outline" className="text-xs capitalize flex-shrink-0">
              {chart.type} Chart
            </Badge>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea className="flex-1 min-h-0">
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
                  className={`flex-1 max-w-[85%] space-y-2 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  } flex flex-col`}
                >
                  <div
                    className={`rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-none"
                        : "bg-muted text-foreground rounded-tl-none"
                    }`}
                  >
                    {msg.content}
                  </div>

                  {/* Chart preview (when AI modified the SQL) */}
                  {msg.role === "assistant" && msg.modifiedSql && (
                    <div className="w-full rounded-xl border border-border bg-background/60 overflow-hidden">
                      <div className="px-3 py-2 border-b border-border bg-muted/40">
                        <p className="text-xs font-medium text-muted-foreground">Modified Query Preview</p>
                      </div>

                      {/* SQL pill */}
                      <div className="px-3 py-2 border-b border-border">
                        <pre className="text-xs text-foreground/80 bg-muted/50 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap max-h-24">
                          <code>{msg.modifiedSql}</code>
                        </pre>
                      </div>

                      {/* Chart */}
                      <div className="p-3">
                        {msg.chartPreview?.isLoading ? (
                          <div className="flex items-center justify-center gap-2 h-32 text-muted-foreground text-xs">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Fetching data…
                          </div>
                        ) : msg.chartPreview?.error ? (
                          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground text-center px-4">
                            <span>{msg.chartPreview.error}</span>
                          </div>
                        ) : (msg.chartPreview?.config.data.length ?? 0) === 0 ? (
                          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
                            No data returned for this query.
                          </div>
                        ) : (
                          <ChartCard
                            type={(chart.type ?? "bar") as any}
                            data={msg.chartPreview!.config.data}
                            dataKeys={msg.chartPreview!.config.dataKeys}
                            xAxisKey={msg.chartPreview!.config.xAxisKey}
                            showLegend={false}
                            height={180}
                          />
                        )}
                      </div>

                      {/* Apply / Applied */}
                      <div className="px-3 pb-3 pt-1">
                        {msg.applied ? (
                          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Applied to preview
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <GradientButton
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => handleApply(msg)}
                              disabled={!!msg.chartPreview?.isLoading || !!msg.chartPreview?.error}
                            >
                              Apply to Preview
                            </GradientButton>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 text-muted-foreground"
                              onClick={() =>
                                setMessages((prev) =>
                                  prev.map((m) =>
                                    m.id === msg.id ? { ...m, modifiedSql: undefined, chartPreview: undefined } : m
                                  )
                                )
                              }
                            >
                              <X className="w-3 h-3 mr-1" />
                              Discard
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-xl rounded-tl-none px-3 py-2.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-border px-4 py-3 bg-background">
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
              className="flex-1 resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 min-h-[38px] max-h-[120px] leading-snug"
              style={{ height: "auto" }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = "auto";
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <GradientButton
              size="sm"
              className="h-[38px] w-[38px] p-0 flex-shrink-0 rounded-xl"
              onClick={handleSend}
              disabled={!canSend}
            >
              <Send className="w-4 h-4" />
            </GradientButton>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 px-1">
            Shift + Enter for new line
          </p>
        </div>

      </DialogContent>
    </Dialog>
  );
}
