import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, BarChart3, LineChart, PieChart, AreaChart, ChartScatter, Grid3x3, Funnel, Globe, ChevronDown, ChevronUp, Code, Database, Check, RotateCcw, Microscope } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { GradientButton } from "../../shared/GradientButton";
import { ChartPreviewDialog } from "../charts/ChartPreviewDialog";
import { ProbeModeDialog } from "../charts/ProbeModeDialog";
import { getDashboards, getDatabases, getCurrentUser, getLatestOntology, type Chart as SavedChart } from "../../../services/api";
import { loadDatabaseMetadata, storeDatabaseMetadata, type DatabaseMetadataEntry } from "../../../utils/databaseMetadata";
import { VizAIWebSocket, WebSocketResponse, type ChartSpec } from "../../../services/websocket";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";
import { useChartGenerationStore } from "../../../store/chartGenerationStore";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../../ui/dialog";
import type { ChartAxisConfig, ChartType } from "../charts/core/chartTypes";
import { normalizeChartSpec } from "../../../utils/chartSpecNormalizer";

/** Maps WebSocket `chart_spec` → preview model; all `x_axis` / `y_axis` reads go through `normalizeChartSpec`. */
function chartSuggestionFromWebSocketSpec(
  spec: ChartSpec,
  index: number,
): ChartSuggestion {
  const n = normalizeChartSpec({
    title: spec.title ?? "",
    query: spec.query ?? "",
    chart_type: spec.chart_type ?? "line",
    x_axis: spec.x_axis,
    y_axis: spec.y_axis,
    report: spec.report,
    relevance: typeof spec.relevance === "number" ? spec.relevance : undefined,
    is_time_based: spec.is_time_based,
    data_connection_id: spec.data_connection_id ?? "",
    value_key: spec.value_key,
    category_key: spec.category_key,
    region_key: spec.region_key,
    metric_key: spec.metric_key,
  });

  const primarySeriesKey =
    n.chartType === "pie"
      ? n.axisConfig.valueKey ?? n.yAxisKey
      : n.chartType === "map"
        ? n.axisConfig.metricKey ?? n.yAxisKey
        : n.chartType === "funnel"
          ? n.axisConfig.valueKey ?? n.yAxisKey
          : n.chartType === "heatmap"
            ? n.axisConfig.valueKey ?? n.yAxisKey
            : n.yAxisKey ??
              n.axisConfig.yAxisKey ??
              n.axisConfig.valueKey ??
              n.axisConfig.metricKey;

  return {
    id: `${spec.data_connection_id || "chart"}-${index}-${Date.now()}`,
    name: n.title || `Generated Chart ${index + 1}`,
    type: n.chartType,
    description: spec.report || n.title || "AI-generated chart suggestion",
    query: n.query,
    reasoning: spec.report || "Generated based on your request.",
    interaction: (spec as { interaction?: string }).interaction,
    dataSource: n.dataConnectionId ? `Database ${n.dataConnectionId}` : undefined,
    dataConnectionId: n.dataConnectionId,
    databaseId: n.dataConnectionId,
    relevance: n.relevance,
    spec,
    axisConfig: n.axisConfig,
    xAxisField: n.axisConfig.xAxisKey ?? null,
    yAxisField:
      n.axisConfig.yAxisKey ??
      n.axisConfig.valueKey ??
      n.axisConfig.metricKey ??
      null,
    minMaxDates: spec.min_max_dates ?? null,
    xAxisKey: n.xAxisKey,
    dataKeys: primarySeriesKey ? { primary: primarySeriesKey } : undefined,
  };
}

interface Message {
  id: number;
  type: 'user' | 'ai' | 'chart-suggestions' | 'database-prompt';
  content: string;
  chartSuggestions?: ChartSuggestion[];
}

interface ChartSuggestion {
  id: string;
  name: string;
  type: ChartType;
  description: string;
  query: string;
  reasoning: string;
  interaction?: string; // Added to match schema
  dataSource?: string;
  dataConnectionId?: string;
  databaseId?: string;
  relevance?: number;
  spec?: ChartSpec;
  /** Normalized axis keys from `normalizeChartSpec` — required for scatter / heatmap / funnel / map. */
  axisConfig?: ChartAxisConfig;
  data?: any[];
  dataKeys?: {
    primary: string;
    secondary?: string;
  };
  xAxisKey?: string;
  isLoadingData?: boolean;
  dataError?: string;
  xAxisField?: string | null;
  yAxisField?: string | null;
  minMaxDates?: [string, string] | null;
}

type ChartCreationRequestPayload = {
  nlq_query: string;
  data_connection_id: string;
  db_schema: string;
  db_type: 'postgres' | 'mysql' | 'sqlite' | 'oracledb' | 'salesforce' | 'databricks';
  ontology_context?: Record<string, any>;
  ontology_constraints?: Record<string, any>;
  role: string;
  product_name?: string;
  product_description?: string;
  product_info?: string;
  conversation_summary?: string;
  min_max_dates?: [string, string];
  sample_data?: string;
};

const buildOntologyConstraints = (ontology: Record<string, any> | undefined) => {
  if (!ontology || typeof ontology !== "object") return undefined;
  const classes = Array.isArray(ontology.classes) ? ontology.classes : [];
  const relationships = Array.isArray(ontology.relationships) ? ontology.relationships : [];
  const metrics = Array.isArray(ontology.metrics) ? ontology.metrics : [];
  const rules = ontology.rules && typeof ontology.rules === "object" ? ontology.rules : {};

  const allowed_joins = relationships
    .filter((r: any) => r && r.source && r.target)
    .map((r: any) => ({
      source: r.source,
      target: r.target,
      source_column: r.source_column,
      target_column: r.target_column,
      label: r.label,
    }));

  const metric_defs = metrics.map((m: any) => ({
    name: m?.name,
    definition: m?.definition,
    formula: m?.formula,
    denominator: m?.denominator,
    default_filter: m?.default_filter,
  }));

  return {
    class_count: classes.length,
    allowed_joins,
    metrics: metric_defs,
    default_time_dimension: rules.default_time_dimension ?? null,
    default_time_granularity: rules.default_time_granularity ?? null,
    success_status_values: Array.isArray(rules.status_success_values) ? rules.status_success_values : [],
    default_filters: rules.default_filters ?? {},
  };
};

interface AIAssistantProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId?: number | string;
  currentTab?: string;
  onChartCreated?: (chart: {
    id?: string;
    name: string;
    type: ChartType;
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number | string;
  }) => void;
  editingChart?: {
    name: string;
    type: ChartType;
    description?: string;
  } | null;
}

const chartTypeIcons = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  donut: PieChart,
  area: AreaChart,
  scatter: ChartScatter,
  heatmap: Grid3x3,
  funnel: Funnel,
  map: Globe,
  stackedlinechart: LineChart,
  stackedhorizontalbar: BarChart3,
  clustering: ChartScatter,
  multiyaxischart: BarChart3,
};

const chartTypeColors = {
  line: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  bar: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  pie: "bg-green-500/10 text-green-500 border-green-500/20",
  donut: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  area: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  scatter: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  heatmap: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  funnel: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  map: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  stackedlinechart: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  stackedhorizontalbar: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  clustering: "bg-sky-500/10 text-sky-500 border-sky-500/20",
  multiyaxischart: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
};

const mapDatabaseMetadataToAssistantState = (entry: DatabaseMetadataEntry) => ({
  id: entry.id,
  name: entry.name,
  type: entry.type || "postgresql",
  schema: entry.schema ?? null,
});

const normalizeChartType = (type?: string): ChartType => {
  if (!type) return "line";
  const lower = type.toLowerCase();
  if (lower.includes("scatter")) return "scatter";
  if (lower.includes("heatmap")) return "heatmap";
  if (lower.includes("funnel")) return "funnel";
  if (lower.includes("map") && !lower.includes("heatmap")) return "map";
  if (lower.includes("stackedlinechart") || lower.includes("stacked_line_chart")) return "stackedlinechart";
  if (lower.includes("stackedhorizontalbar") || lower.includes("stacked_horizontal_bar"))
    return "stackedhorizontalbar";
  if (lower.includes("clustering") || lower.includes("cluster")) return "clustering";
  if (
    lower.includes("multiyaxischart") ||
    lower.includes("multi_y_axis_chart") ||
    lower.includes("multiyaxis")
  )
    return "multiyaxischart";
  if (lower.includes("bar")) return "bar";
  if (lower.includes("donut")) return "donut";
  if (lower.includes("pie")) return "pie";
  if (lower.includes("area")) return "area";
  return "line";
};

const normalizeDbType = (type?: string): 'postgres' | 'mysql' | 'sqlite' | 'oracledb' | 'salesforce' | 'databricks' => {
  if (!type) return 'postgres';
  const lower = type.toLowerCase();
  if (lower.includes('databricks')) return 'databricks';
  if (lower.includes('salesforce')) return 'salesforce';
  if (lower.includes('oracle')) return 'oracledb';
  if (lower.includes('mysql')) return 'mysql';
  if (lower.includes('sqlite')) return 'sqlite';
  if (lower.includes('postgres') || lower.includes('pg')) return 'postgres';
  return 'postgres';
};

const ensureSchemaString = (schema?: string | null): string => {
  if (!schema) {
    return "";
  }
  try {
    const parsed = JSON.parse(schema);
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { tables?: unknown[] }).tables) &&
      (parsed as { tables?: unknown[] }).tables!.length === 0
    ) {
      return "";
    }
    return schema;
  } catch (error) {
    console.warn('AIAssistant: Received invalid schema JSON, omitting schema from payload', { error });
    return "";
  }
};

export function AIAssistant({ isOpen, onOpenChange, projectId, currentTab, onChartCreated, editingChart }: AIAssistantProps) {
  const {
    messages: storeMessages,
    selectedDatabase: storeSelectedDatabase,
    isGenerating: storeIsGenerating,
    chartWorkflowState: storeChartWorkflowState,
    setMessages: setStoreMessages,
    setSelectedDatabase: setStoreSelectedDatabase,
    setIsGenerating: setStoreIsGenerating,
    setChartWorkflowState: setStoreChartWorkflowState,
  } = useChartGenerationStore();

  const [messages, setMessages] = useState<Message[]>(storeMessages);
  const [input, setInput] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState(storeSelectedDatabase);
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(storeIsGenerating);
  const [previewChart, setPreviewChart] = useState<ChartSuggestion | null>(null);
  const [probeModeChart, setProbeModeChart] = useState<ChartSuggestion | null>(null);
  const [showDatabaseSelection, setShowDatabaseSelection] = useState(!storeSelectedDatabase);
  const [dashboards, setDashboards] = useState<Array<{ id: string | number; name: string }>>([]);
  const [databases, setDatabases] = useState<Array<{ id: string; name: string; type: string; schema?: string | null }>>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const chartRequestRef = useRef<ChartCreationRequestPayload | null>(null);
  const [isAwaitingClarification, setIsAwaitingClarification] = useState(false);
  const [chartWorkflowState, setChartWorkflowState] = useState<Record<string, any> | null>(storeChartWorkflowState);
  const chartWorkflowStateRef = useRef<Record<string, any> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);

  const isFollowUpQuestion = (messageText: string): boolean => {
    if (!messageText) return false;
    const trimmed = messageText.trim();
    const questionPattern = /^Question\s+\d+:/i;
    return questionPattern.test(trimmed);
  };

  const isRestoringRef = useRef(false);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const storeState = useChartGenerationStore.getState();
      isRestoringRef.current = true;
      setMessages(storeState.messages);

      if (storeState.selectedDatabase) {
        setSelectedDatabase(storeState.selectedDatabase);
        setShowDatabaseSelection(false);
      } else {
        setShowDatabaseSelection(true);
      }

      setIsGenerating(storeState.isGenerating);
      if (storeState.chartWorkflowState) {
        setChartWorkflowState(storeState.chartWorkflowState);
      }

      setTimeout(() => {
        isRestoringRef.current = false;
      }, 300);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const prevMessagesRef = useRef<Message[]>([]);
  useEffect(() => {
    if (isRestoringRef.current) {
      prevMessagesRef.current = messages;
      return;
    }

    const messagesChanged = JSON.stringify(prevMessagesRef.current) !== JSON.stringify(messages);
    if (messagesChanged && messages.length > 0) {
      setStoreMessages(messages);
    }
    prevMessagesRef.current = messages;
  }, [messages, setStoreMessages]);

  useEffect(() => {
    if (!isRestoringRef.current && selectedDatabase) {
      setStoreSelectedDatabase(selectedDatabase);
    }
  }, [selectedDatabase, setStoreSelectedDatabase]);

  useEffect(() => {
    if (!isRestoringRef.current && isOpen) {
      setStoreIsGenerating(isGenerating);
    }
  }, [isGenerating, isOpen, setStoreIsGenerating]);

  useEffect(() => {
    if (!isRestoringRef.current) {
      setStoreChartWorkflowState(chartWorkflowState);
    }
  }, [chartWorkflowState, setStoreChartWorkflowState]);

  useEffect(() => {
    if (!isOpen && previewChart) {
      setPreviewChart(null);
      setExpandedSuggestion(null);
    }
  }, [isOpen, previewChart]);

  useEffect(() => {
    chartWorkflowStateRef.current = chartWorkflowState;
  }, [chartWorkflowState]);

  useEffect(() => {
    if (selectedDatabase && !isGenerating && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedDatabase, isGenerating]);

  const replaceAnalyzingMessage = (content: string) => {
    setMessages((prev) => {
      if (prev.length === 0) {
        return [{ id: 1, type: 'ai', content }];
      }

      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        const message = updated[i];
        if (message.type === 'ai' && message.content === 'Analyzing your request and generating chart suggestions...') {
          updated[i] = { ...message, content };
          return updated;
        }
      }

      return [...updated, { id: prev.length + 1, type: 'ai', content }];
    });
  };

  const buildClarificationMessage = (response: WebSocketResponse): string => {
    const segments: string[] = [];
    if (response.message) {
      segments.push(response.message);
    }
    if (Array.isArray(response.missing_fields) && response.missing_fields.length > 0) {
      segments.push(`Still need: ${response.missing_fields.join(', ')}`);
    }
    const clarityQuestions = Array.isArray(response.state?.clarity_questions)
      ? (response.state?.clarity_questions as string[])
      : [];
    if (clarityQuestions.length > 0) {
      const formattedQuestions = clarityQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n');
      segments.push(`Follow-up question${clarityQuestions.length > 1 ? 's' : ''}:\n${formattedQuestions}`);
    }
    segments.push('Please provide more details so I can generate the right charts.');
    return segments.join('\n\n');
  };

  useEffect(() => {
    if (projectId && isOpen) {
      fetchDashboards();
      fetchDatabases();
    }
  }, [projectId, isOpen]);

  const prevTabRef = useRef<string | undefined>(currentTab);

  useEffect(() => {
    const prevTab = prevTabRef.current;
    if (prevTab === 'charts' && currentTab !== 'charts' && wsClient) {
      wsClient.disconnect();
      setWsClient(null);
    }
    prevTabRef.current = currentTab;
  }, [currentTab, wsClient]);

  useEffect(() => {
    if (!isOpen || !userId) {
      return;
    }

    // New VizAIWebSocket each time the panel opens → new connectionId / LangGraph thread_id.
    // Same client (and ID) for all chart requests while the panel stays open so memory stays useful.
    let cancelled = false;
    const client = new VizAIWebSocket(userId);
    setIsConnecting(true);
    setConnectionError(null);

    const removeAnalyzingMessage = () => {
      setMessages((prev) => {
        return prev.filter(
          (msg) => !(msg.type === 'ai' && msg.content === 'Analyzing your request and generating chart suggestions...')
        );
      });
    };

    const showChartSuggestions = (
      chartSpecs: ChartSpec[],
      {
        message,
        clarityQs = [],
      }: { message?: string; clarityQs?: string[] } = {}
    ) => {

      // --- INTERCEPT CONVERSATIONAL MESSAGES ---
      if (chartSpecs.length === 1) {
        const spec: any = chartSpecs[0];
        if (spec.interaction || spec.chart_type?.toLowerCase() === 'none') {
          const messageContent = spec.interaction || spec.report || spec.title || "Hello! How can I help you today?";

          removeAnalyzingMessage();

          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              type: 'ai',
              content: messageContent,
            },
          ]);

          return; // Stop execution so it doesn't build a chart card
        }
      }
      // -----------------------------------------

      if (!chartSpecs.length) {
        const errorMessage = message || "I couldn't find any relevant charts based on that request. Try rephrasing or providing more detail.";
        removeAnalyzingMessage();
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            type: 'ai',
            content: errorMessage,
          },
        ]);
        return;
      }

      const suggestions: ChartSuggestion[] = chartSpecs.map(
        chartSuggestionFromWebSocketSpec,
      );

      const contentMessage =
        message ||
        `I've analyzed your request and generated ${suggestions.length} chart suggestion${suggestions.length > 1 ? 's' : ''}.`;

      removeAnalyzingMessage();
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: prev.length + 1,
            type: 'chart-suggestions' as const,
            content: contentMessage,
            chartSuggestions: suggestions,
          },
        ];
        return newMessages;
      });
    };

    const handleChartCreation = (response: WebSocketResponse) => {
      const clarityQs = Array.isArray(response.state?.clarity_questions)
        ? (response.state?.clarity_questions as string[])
        : [];

      if (response.status === 'collecting') {
        setIsGenerating(false);

        const messageText = response.message || '';
        const hasQuestionPattern = isFollowUpQuestion(messageText);

        setIsAwaitingClarification(hasQuestionPattern);
        setChartWorkflowState(response.state ?? null);

        const chartSpecs = (response.state?.chart_specs as ChartSpec[]) || [];

        if (chartSpecs.length > 0) {
          const message = response.message || "Here are a few starter charts for this data source.";
          showChartSuggestions(chartSpecs, { message, clarityQs });
        } else {
          replaceAnalyzingMessage(buildClarificationMessage(response));
        }
        return;
      }

      if (response.status === 'completed') {
        setConnectionError(null);
        const chartSpecs = (response.state?.chart_specs as ChartSpec[]) || [];
        setIsGenerating(false);
        setIsAwaitingClarification(false);
        chartRequestRef.current = null;
        setChartWorkflowState(response.state ?? null);

        showChartSuggestions(chartSpecs, { message: response.message, clarityQs });
      } else if (response.status === 'error') {
        setIsGenerating(false);
        setIsAwaitingClarification(false);
        setChartWorkflowState(response.state ?? null);
        const errorMessage = response.error || response.message || "Unable to generate charts right now.";
        setConnectionError(errorMessage);
        console.error('[AIAssistant] chart_creation error:', errorMessage);
        toast.error(errorMessage);
        replaceAnalyzingMessage(errorMessage);
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            type: 'ai',
            content: errorMessage,
          },
        ]);
      }
    };

    const handleRegenerate = (response: WebSocketResponse) => {
      if (response.status === 'collecting' || response.status === 'completed') {
        setIsGenerating(false);
        const chartSpecs = (response.state?.chart_specs as ChartSpec[]) || [];
        if (chartSpecs.length > 0) {
          const processChartSpecs = (chartSpecs: ChartSpec[], message?: string) => {
            const suggestions: ChartSuggestion[] = chartSpecs.map(
              chartSuggestionFromWebSocketSpec,
            );

            const contentMessage = message || `I've generated ${suggestions.length} new chart suggestion${suggestions.length > 1 ? 's' : ''}.`;

            setMessages((prev) => {
              const filtered = prev.filter(m => m.content !== 'Generating more chart suggestions...');
              return [
                ...filtered,
                {
                  id: filtered.length + 1,
                  type: 'chart-suggestions',
                  content: contentMessage,
                  chartSuggestions: suggestions,
                },
              ];
            });
          };
          processChartSpecs(chartSpecs, response.message);
        }
      } else if (response.status === 'error') {
        setIsGenerating(false);
        toast.error(response.error || response.message || "Failed to regenerate charts");
      }
    };

    client.on('chart_creation', handleChartCreation);
    client.on('regenerate', handleRegenerate);
    client.onError((error) => {
      console.error('[AIAssistant] WebSocket error:', error);
      setIsGenerating(false);
      setConnectionError(error.message || 'WebSocket connection error');
      toast.error('Connection lost. Please try again.');
    });

    client.connect()
      .then(() => {
        if (!cancelled) {
          setWsClient(client);
          setIsConnecting(false);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[AIAssistant] Failed to connect to WebSocket:', error);
          setIsConnecting(false);
          setConnectionError(error?.message || 'Failed to connect to AI assistant');
          toast.error(error?.message || 'Failed to connect to AI assistant');
        }
      });

    return () => {
      cancelled = true;
      client.disconnect();
      setWsClient(null);
      setIsConnecting(false);
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;

    const fetchUserId = async () => {
      try {
        const response = await getCurrentUser();
        if (isMounted && response.success && response.data?.id) {
          setUserId(response.data.id);
        }
      } catch (error: any) {
        console.error("AIAssistant: Failed to fetch current user:", error);
        toast.error(error?.message || "Unable to load user information for AI assistant");
      }
    };

    if (!userId) {
      fetchUserId();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId]);

  const fetchDashboards = async () => {
    if (!projectId) return;

    try {
      const response = await getDashboards(String(projectId));

      if (response.success && response.data && Array.isArray(response.data)) {
        const fetchedDashboards = response.data.map(d => ({ id: d.id, name: d.name }));
        setDashboards(fetchedDashboards);
      } else {
        console.warn('AIAssistant: getDashboards failed or no data', {
          success: response.success,
          error: response.error,
          data: response.data
        });
      }
    } catch (err) {
      console.error("AIAssistant: Failed to fetch dashboards:", err);
    }
  };

  const fetchDatabases = async () => {
    if (!projectId) return;

    const cached = loadDatabaseMetadata(String(projectId));
    if (cached && cached.length > 0) {
      setDatabases(cached.map(mapDatabaseMetadataToAssistantState));
    }

    setIsLoadingDatabases(!(cached && cached.length > 0));
    try {
      const response = await getDatabases(String(projectId));
      if (response.success && response.data) {
        const fetchedDatabases = response.data.map((db) => ({
          id: db.id,
          name: db.name,
          type: db.type,
          schema: db.schema ?? null,
        }));
        setDatabases(fetchedDatabases);
        storeDatabaseMetadata(String(projectId), fetchedDatabases);

        if (fetchedDatabases.length === 0) {
          toast.info("No database connections found. Please add a database connection first.");
        }
      } else {
        toast.error(response.error?.message || "Failed to fetch database connections");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch database connections");
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  useEffect(() => {
    if (isRestoringRef.current) {
      return;
    }

    if (editingChart && isOpen) {
      setMessages([
        {
          id: 1,
          type: 'ai',
          content: `I'll help you modify "${editingChart.name}". What changes would you like to make? You can update the chart type, modify data sources, or adjust the visualization.`
        }
      ]);
      setShowDatabaseSelection(false);
      setSelectedDatabase('editing-mode');
      setShowWelcomeScreen(false);
    } else if (!editingChart && isOpen && messages.length === 0) {
      const storeState = useChartGenerationStore.getState();
      if (storeState.messages.length === 0) {
        setShowWelcomeScreen(true);
        setMessages([
          {
            id: 1,
            type: 'ai',
            content: "Hi! 👋 I'm your VizAI assistant. I'll help you set up your analytics product through a quick conversation. Ready to get started?"
          }
        ]);
        setShowDatabaseSelection(false);
        setSelectedDatabase('');
      } else {
        setShowWelcomeScreen(false);
      }
    } else {
      setShowWelcomeScreen(false);
    }
  }, [editingChart, isOpen, messages.length]);

  const availableDatabases = databases.length > 0
    ? databases.map(db => ({
      value: db.id,
      label: db.name,
      id: db.id,
      name: db.name,
      type: db.type,
      schema: db.schema ?? null,
    }))
    : [
      { value: "sales-db", label: "Sales Database", id: "sales-db", name: "Sales Database", type: "postgresql", schema: null },
      { value: "inventory-db", label: "Inventory DB", id: "inventory-db", name: "Inventory DB", type: "postgresql", schema: null },
      { value: "analytics-db", label: "Analytics DB", id: "analytics-db", name: "Analytics DB", type: "mysql", schema: null },
      { value: "customer-db", label: "Customer DB", id: "customer-db", name: "Customer DB", type: "mysql", schema: null },
      { value: "marketing-db", label: "Marketing DB", id: "marketing-db", name: "Marketing DB", type: "postgresql", schema: null }
    ];

  const handleDatabaseSelect = (dbValue: string) => {
    setSelectedDatabase(dbValue);
    const selectedDb = availableDatabases.find(db => db.value === dbValue || db.id === dbValue);

    chartRequestRef.current = null;
    setIsAwaitingClarification(false);
    setChartWorkflowState(null);
    setShowWelcomeScreen(false);

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: `Selected: ${selectedDb?.label}`
    };

    setMessages(prev => [...prev, userMessage]);
    setShowDatabaseSelection(false);

    setIsSettingUp(true);
    setTimeout(() => {
      setIsSettingUp(false);
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          type: 'ai',
          content: "Now you can generate charts by giving prompts or click the button below to auto-generate charts using AI."
        }
      ]);
    }, 800);
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    if (!selectedDatabase) {
      setShowDatabaseSelection(true);
      const aiMessage: Message = {
        id: messages.length + 1,
        type: 'database-prompt',
        content: 'Please select a database first before I can generate charts for you.'
      };
      setMessages(prev => [...prev, aiMessage]);
      return;
    }

    if (!wsClient || !wsClient.isConnected()) {
      toast.error(isConnecting ? "Still connecting to AI assistant..." : "AI assistant is not connected. Please try again.");
      return;
    }

    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);
    if (!selectedDb) {
      toast.error("Please select a valid database connection first.");
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealDatabase = uuidRegex.test(String(selectedDb.id));
    if (!isRealDatabase && databases.length > 0) {
      toast.error("Please select a valid database connection from the list.");
      return;
    }

    const schemaString = ensureSchemaString(selectedDb.schema);

    const lastAIMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.type === 'ai' || msg.type === 'database-prompt');
    const isFollowUpQuestionDetected = lastAIMessage
      ? isFollowUpQuestion(lastAIMessage.content)
      : false;

    const isFollowUpResponse = isAwaitingClarification
      && isFollowUpQuestionDetected
      && chartRequestRef.current !== null;

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: trimmedInput,
    };

    const loadingMessage: Message = {
      id: messages.length + 2,
      type: 'ai',
      content: 'Analyzing your request and generating chart suggestions...'
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInput("");
    setIsGenerating(true);
    setConnectionError(null);

    if (!isFollowUpResponse) {
      setIsAwaitingClarification(false);
      setChartWorkflowState(null);
    }

    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    const dbType = normalizeDbType(selectedDb.type);
    let ontologyContext: Record<string, any> | undefined;
    let ontologyConstraints: Record<string, any> | undefined;
    try {
      const ontologyResponse = await getLatestOntology(String(selectedDb.id));
      if (ontologyResponse.success && ontologyResponse.data?.ontology) {
        ontologyContext = ontologyResponse.data.ontology;
        ontologyConstraints = buildOntologyConstraints(ontologyContext);
      }
    } catch (error) {
      console.warn("[AIAssistant] Failed to load ontology context for chart generation", error);
    }

    let payload: ChartCreationRequestPayload;

    if (isFollowUpResponse && chartRequestRef.current) {
      payload = {
        ...chartRequestRef.current,
        data_connection_id: String(selectedDb.id),
        db_schema: schemaString,
        db_type: dbType,
        ontology_context: ontologyContext,
        ontology_constraints: ontologyConstraints,
      };
    } else {
      payload = {
        nlq_query: trimmedInput,
        data_connection_id: String(selectedDb.id),
        db_schema: schemaString,
        db_type: dbType,
        ontology_context: ontologyContext,
        ontology_constraints: ontologyConstraints,
        role: 'Analyst',
      };
      chartRequestRef.current = { ...payload };
      setIsAwaitingClarification(false);
    }

    try {
      if (isFollowUpResponse) {
        wsClient.chartCreation({
          ...payload,
          user_response: trimmedInput,
          existing_state: chartWorkflowState ?? undefined,
          continue_workflow: true,
        });
        setIsAwaitingClarification(false);
      } else {
        wsClient.chartCreation({
          ...payload,
        });
      }
    } catch (error: any) {
      setIsGenerating(false);
      toast.error(error?.message || 'Failed to submit your request. Please try again.');
    }
  };

  const handleRegenerateCharts = async () => {
    if (!wsClient || !wsClient.isConnected()) {
      toast.error(isConnecting ? "Still connecting to AI assistant..." : "AI assistant is not connected. Please try again.");
      return;
    }

    if (!selectedDatabase) {
      toast.error("Please select a database first.");
      return;
    }

    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);
    if (!selectedDb) {
      toast.error("Please select a valid database connection first.");
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealDatabase = uuidRegex.test(String(selectedDb.id));
    if (!isRealDatabase && databases.length > 0) {
      toast.error("Please select a valid database connection from the list.");
      return;
    }

    const schemaString = ensureSchemaString(selectedDb.schema);
    const dbType = normalizeDbType(selectedDb.type);
    let ontologyContext: Record<string, any> | undefined;
    let ontologyConstraints: Record<string, any> | undefined;
    try {
      const ontologyResponse = await getLatestOntology(String(selectedDb.id));
      if (ontologyResponse.success && ontologyResponse.data?.ontology) {
        ontologyContext = ontologyResponse.data.ontology;
        ontologyConstraints = buildOntologyConstraints(ontologyContext);
      }
    } catch (error) {
      console.warn("[AIAssistant] Failed to load ontology context for regenerate", error);
    }

    const hasExistingCharts = messages.some(m => m.type === 'chart-suggestions');

    setIsGenerating(true);
    setMessages(prev => [
      ...prev,
      { id: prev.length + 1, type: 'ai', content: hasExistingCharts ? 'Generating more chart suggestions...' : 'Analyzing your request and generating chart suggestions...' }
    ]);

    try {
      if (hasExistingCharts) {
        wsClient.regenerate({
          data_connection_id: String(selectedDb.id),
          db_schema: schemaString,
          db_type: dbType,
          ontology_context: ontologyContext,
          ontology_constraints: ontologyConstraints,
          role: 'Analyst',
          domain: 'admin',
        } as any); // <-- ADD "as any" HERE
      } else {
        wsClient.send({
          event_type: 'chart_creation',
          user_id: userId!,
          payload: {
            nlq_query: null,
            data_connection_id: String(selectedDb.id),
            db_schema: schemaString,
            db_type: dbType,
            ontology_context: ontologyContext,
            ontology_constraints: ontologyConstraints,
            role: 'Analyst',
            domain: 'admin',
            project_id: projectId || undefined,
            suggestion_count: 3,
          },
        });
      }
    } catch (error: any) {
      console.error('[AIAssistant] Failed to generate charts:', error);
      setIsGenerating(false);
      toast.error(error?.message || 'Failed to generate charts. Please try again.');
    }
  };

  const handleOpenProbeMode = async (suggestion: ChartSuggestion) => {
    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);
    if (!selectedDb?.id) {
      toast.error("Please select a valid database connection first.");
      return;
    }
    const schemaString = ensureSchemaString(selectedDb.schema);
    const dbType = normalizeDbType(selectedDb.type);
    let ontologyContext: Record<string, any> | undefined;
    let ontologyConstraints: Record<string, any> | undefined;
    try {
      const ontologyResponse = await getLatestOntology(String(selectedDb.id));
      if (ontologyResponse.success && ontologyResponse.data?.ontology) {
        ontologyContext = ontologyResponse.data.ontology;
        ontologyConstraints = buildOntologyConstraints(ontologyContext);
      }
    } catch (error) {
      console.warn("[AIAssistant] Failed to load ontology context for probe mode", error);
    }
    // Cast to `any` to carry db_schema / db_type alongside the standard ChartSuggestion fields.
    // ProbeModeDialog reads these extra fields when building the first-turn context block.
    setProbeModeChart({
      ...suggestion,
      dataConnectionId: suggestion.dataConnectionId || selectedDb.id,
      databaseId: suggestion.dataConnectionId || selectedDb.id,
      db_schema: schemaString,
      db_type: dbType,
      ontology_context: ontologyContext,
      ontology_constraints: ontologyConstraints,
    } as any);
  };

  const handleCreateChart = (suggestion: ChartSuggestion) => {
    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);

    if (!selectedDb || !selectedDb.id) {
      toast.error("Please select a valid database connection first.");
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealDatabase = uuidRegex.test(selectedDb.id);

    if (!isRealDatabase && databases.length > 0) {
      toast.error("Please select a valid database connection from the list.");
      return;
    }

    const fallbackXAxis =
      suggestion.xAxisKey ??
      suggestion.axisConfig?.xAxisKey ??
      suggestion.xAxisField;
    const fallbackDataKeys =
      suggestion.dataKeys ||
      (suggestion.axisConfig?.yAxisKey
        ? { primary: suggestion.axisConfig.yAxisKey }
        : suggestion.yAxisField
          ? { primary: suggestion.yAxisField }
          : undefined);

    const chartWithDataSource: ChartSuggestion = {
      ...suggestion,
      dataSource: `Database ${selectedDb.id}`,
      dataConnectionId: suggestion.dataConnectionId || selectedDb.id,
      databaseId: suggestion.dataConnectionId || selectedDb.id,
      xAxisKey: fallbackXAxis,
      dataKeys: fallbackDataKeys,
    };

    setPreviewChart(chartWithDataSource);
  };

  const handleSaveAsDraft = (savedChart?: SavedChart) => {
    if (!previewChart) return;

    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);

    if (!selectedDb || !selectedDb.id) {
      toast.error("Database connection is required");
      return;
    }

    onChartCreated?.({
      id: savedChart?.id,
      name: previewChart.name,
      type: previewChart.type,
      dataSource: `Database ${selectedDb.id}`,
      query: previewChart.query,
      status: 'draft'
    });

    const updatedMessages = messages.map(msg => {
      if (msg.type === 'chart-suggestions' && msg.chartSuggestions) {
        return {
          ...msg,
          chartSuggestions: msg.chartSuggestions.filter(s => s.id !== previewChart.id)
        };
      }
      return msg;
    });
    setMessages(updatedMessages);
    setStoreMessages(updatedMessages);

    setPreviewChart(null);
  };

  const handleProbeSaveAsDraft = (savedChart?: SavedChart) => {
    if (!probeModeChart) return;
    const selectedDb = availableDatabases.find(
      (db) => db.value === selectedDatabase || db.id === selectedDatabase
    );
    if (!selectedDb?.id) {
      toast.error("Database connection is required");
      return;
    }
    onChartCreated?.({
      id: savedChart?.id,
      name: probeModeChart.name,
      type: (savedChart?.type ?? probeModeChart.type) as ChartType,
      dataSource: `Database ${selectedDb.id}`,
      query: savedChart?.query ?? probeModeChart.query ?? "",
      status: "draft",
    });
  };

  const handleAddChartToDashboard = (dashboardId: number | string) => {
    if (!previewChart) return;

    if (onChartCreated && dashboardId) {
      onChartCreated({
        name: previewChart.name,
        type: previewChart.type,
        dataSource: previewChart.dataSource || '',
        query: previewChart.query,
        status: 'published',
        dashboardId: dashboardId
      });
    }

    const updatedMessages = messages.map(msg => {
      if (msg.type === 'chart-suggestions' && msg.chartSuggestions) {
        return {
          ...msg,
          chartSuggestions: msg.chartSuggestions.filter(s => s.id !== previewChart.id)
        };
      }
      return msg;
    });
    setMessages(updatedMessages);
    setStoreMessages(updatedMessages);

    setPreviewChart(null);
  };

  const toggleSuggestionExpand = (id: string) => {
    setExpandedSuggestion(expandedSuggestion === id ? null : id);
  };

  const parseQuestions = (content: string): { hasQuestions: boolean; parts: Array<{ type: 'text' | 'question'; content: string; questionNumber?: number }> } => {
    const questionRegex = /Question\s+(\d+):\s*([^Q]+?)(?=Question\s+\d+:|$)/gi;
    const matches = Array.from(content.matchAll(questionRegex));

    if (!matches || matches.length === 0) {
      return { hasQuestions: false, parts: [{ type: 'text', content }] };
    }

    const parts: Array<{ type: 'text' | 'question'; content: string; questionNumber?: number }> = [];
    let lastIndex = 0;

    matches.forEach((match) => {
      if (match.index === undefined) return;

      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index).trim();
        if (textBefore) {
          parts.push({ type: 'text', content: textBefore });
        }
      }

      const questionNumber = parseInt(match[1], 10);
      const questionContent = match[2].trim();

      if (questionNumber && questionContent) {
        parts.push({
          type: 'question',
          content: questionContent,
          questionNumber
        });
      }

      lastIndex = match.index + match[0].length;
    });

    if (lastIndex < content.length) {
      const textAfter = content.substring(lastIndex).trim();
      if (textAfter) {
        parts.push({ type: 'text', content: textAfter });
      }
    }

    return { hasQuestions: true, parts };
  };

  const handleGetStarted = () => {
    setShowWelcomeScreen(false);
    setShowDatabaseSelection(true);
    setMessages([
      {
        id: 1,
        type: 'database-prompt',
        content: 'Hello! I\'m VizAI. To get started, please select which database you\'d like to generate charts from.'
      }
    ]);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          className="w-full p-0 flex flex-col overflow-hidden"
          style={{ maxWidth: '65vw', maxHeight: '90vh', height: '85vh' }}
          hideCloseButton={true}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-lg font-semibold text-foreground">VizAI Assistant</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Ready to help you get started.</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="h-9 w-9 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </DialogHeader>

          {editingChart && (
            <div className="px-6 py-4 bg-muted/50 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${chartTypeColors[editingChart.type]} border`}>
                  {(() => {
                    const Icon = chartTypeIcons[editingChart.type];
                    return <Icon className="w-5 h-5" />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-xs text-muted-foreground">Editing Chart</p>
                    <Badge variant="outline" className="text-xs h-5">
                      {editingChart.type}
                    </Badge>
                  </div>
                  <h4 className="text-sm text-foreground truncate">{editingChart.name}</h4>
                  {editingChart.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{editingChart.description}</p>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                All chart modifications will be applied to this chart. Ask me to change the chart type, update data, or modify styling.
              </p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-background min-h-0">
            {connectionError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {connectionError}
              </div>
            )}
            <AnimatePresence>
              {messages.map((message) => (
                <div key={message.id}>
                  {message.type === 'user' && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gradient-to-r from-primary to-accent text-white">
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  )}

                  {(message.type === 'ai' || message.type === 'database-prompt') && (() => {
                    const { hasQuestions, parts } = parseQuestions(message.content);

                    return (
                      <div className="flex justify-start items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="max-w-[85%] space-y-3">
                          {hasQuestions ? (
                            parts.map((part, idx) => {
                              if (part.type === 'question') {
                                return (
                                  <div
                                    key={idx}
                                    className="rounded-xl px-4 py-3 bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-foreground"
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0">
                                        <span className="text-xs font-semibold text-white">{part.questionNumber}</span>
                                      </div>
                                      <p className="text-sm font-medium text-foreground flex-1">
                                        Question {part.questionNumber}:
                                      </p>
                                    </div>
                                    <p className="text-sm leading-relaxed text-foreground ml-8">
                                      {part.content}
                                    </p>
                                  </div>
                                );
                              } else {
                                return part.content ? (
                                  <div
                                    key={idx}
                                    className="rounded-2xl px-4 py-3 bg-card border border-border text-foreground"
                                  >
                                    <p className="text-sm leading-relaxed whitespace-pre-line">{part.content}</p>
                                  </div>
                                ) : null;
                              }
                            })
                          ) : (
                            <div className="rounded-2xl px-4 py-3 bg-card border border-border text-foreground">
                              <p className="text-sm leading-relaxed whitespace-pre-line">{message.content}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {message.type === 'chart-suggestions' && (
                    <div className="space-y-3">
                      <div className="flex justify-start items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground">
                          <p className="text-sm leading-relaxed">{message.content}</p>
                        </div>
                      </div>

                      {message.chartSuggestions && message.chartSuggestions.length > 0 && (
                        <div className="space-y-3">
                          {message.chartSuggestions.map((suggestion) => {
                            const Icon = chartTypeIcons[suggestion.type];
                            const isExpanded = expandedSuggestion === suggestion.id;

                            return (
                              <Card key={suggestion.id} className="border-border p-3">
                                <div className="space-y-3">
                                  <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${chartTypeColors[suggestion.type]}`}>
                                      <Icon className="w-5 h-5" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm text-foreground">{suggestion.name}</h4>
                                        <Badge variant="outline" className="capitalize text-xs">
                                          {suggestion.type}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                                    </div>
                                  </div>

                                  <div className="flex flex-col gap-2">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => toggleSuggestionExpand(suggestion.id)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg hover:bg-muted/50"
                                      >
                                        <Code className="w-3.5 h-3.5" />
                                        {isExpanded ? 'Hide' : 'View'} Details
                                        {isExpanded ? (
                                          <ChevronUp className="w-3.5 h-3.5" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5" />
                                        )}
                                      </button>

                                      <GradientButton
                                        onClick={() => handleCreateChart(suggestion)}
                                        size="sm"
                                        className="gap-2"
                                      >
                                        Preview
                                      </GradientButton>

                                      {suggestion.query && (
                                        <GradientButton
                                          onClick={() => handleOpenProbeMode(suggestion)}
                                          size="sm"
                                          className="gap-2 shadow-md glow hover:shadow-xl transition-all"
                                        >
                                          <Microscope className="w-3.5 h-3.5" />
                                          Probe Mode
                                        </GradientButton>
                                      )}
                                    </div>
                                  </div>

                                  {isExpanded && (
                                    <div className="space-y-3 pt-2 border-t border-border">
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-2">AI Reasoning:</p>
                                        <p className="text-xs text-foreground bg-muted/50 p-2 rounded-lg">
                                          {suggestion.reasoning}
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-2">SQL Query:</p>
                                        <pre className="text-xs bg-muted/50 p-2 rounded-lg overflow-x-auto">
                                          <code className="text-foreground">{suggestion.query}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            );
                          })}

                          <div className="flex justify-center pt-2">
                            <Button
                              onClick={handleRegenerateCharts}
                              disabled={isGenerating || !wsClient || !wsClient.isConnected()}
                              size="sm"
                              className="gap-2 bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white shadow-md transition-all disabled:opacity-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Let AI Generate Charts
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </AnimatePresence>

            {isGenerating && (
              <div className="flex justify-start items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    <span className="text-sm text-muted-foreground ml-2">Generating charts...</span>
                  </div>
                </div>
              </div>
            )}

            {isSettingUp && (
              <div className="flex justify-start items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            {showWelcomeScreen && messages.length > 0 && messages[0].type === 'ai' && (
              <div className="flex justify-center pt-4 pb-6">
                <GradientButton
                  onClick={handleGetStarted}
                  className="w-full max-w-md h-12 text-base font-medium gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Let's Get Started
                </GradientButton>
              </div>
            )}

            {selectedDatabase && !showWelcomeScreen && !showDatabaseSelection && !messages.some(m => m.type === 'chart-suggestions') && !isGenerating && (
              <div className="flex justify-center pt-4 pb-6">
                <Button
                  onClick={handleRegenerateCharts}
                  disabled={isGenerating || !wsClient || !wsClient.isConnected()}
                  className="gap-2 bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white shadow-md transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5" />
                  Let AI Generate Charts
                </Button>
              </div>
            )}
          </div>

          {showDatabaseSelection && (
            <div className="px-6 pb-4 border-t border-border bg-background shrink-0">
              <div className="space-y-2.5 pt-4">
                <label className="text-xs text-muted-foreground flex items-center gap-2">
                  <Database className="w-3.5 h-3.5" />
                  Select Database
                </label>
                {isLoadingDatabases ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span>Loading databases...</span>
                  </div>
                ) : availableDatabases.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">
                    No database connections available. Please add a database connection to get started.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableDatabases.map((db) => (
                      <button
                        key={db.value}
                        onClick={() => handleDatabaseSelect(db.value)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${selectedDatabase === db.value
                          ? 'bg-gradient-to-r from-primary to-accent text-white shadow-sm'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border'
                          }`}
                      >
                        {selectedDatabase === db.value && (
                          <Check className="w-3 h-3" />
                        )}
                        <Database className="w-3 h-3" />
                        {db.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedDatabase && !showWelcomeScreen && (
            <div className="p-6 border-t border-border bg-background shrink-0">
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isGenerating) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Describe the charts you need..."
                  disabled={isGenerating}
                  className="flex-1 px-4 py-3 bg-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
                  autoFocus
                />
                <GradientButton
                  onClick={handleSend}
                  disabled={
                    !input.trim() ||
                    isGenerating ||
                    isConnecting ||
                    !selectedDatabase ||
                    !(wsClient && wsClient.isConnected())
                  }
                  size="icon"
                  className="flex-shrink-0 h-11 w-11"
                >
                  <Send className="w-5 h-5" />
                </GradientButton>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ChartPreviewDialog
        isOpen={isOpen && !!previewChart}
        onClose={() => setPreviewChart(null)}
        chart={isOpen ? previewChart : null}
        projectId={projectId}
        dashboards={dashboards}
        onAddToDashboard={handleAddChartToDashboard}
        onSaveAsDraft={handleSaveAsDraft}
        onOpenProbeMode={
          previewChart?.query?.trim()
            ? () => {
                const chartForProbe = previewChart;
                if (!chartForProbe?.query?.trim()) return;
                setPreviewChart(null);
                handleOpenProbeMode(chartForProbe as ChartSuggestion);
              }
            : undefined
        }
      />

      {/* Probe Mode — opens directly from the chart card, no preview step needed */}
      {!!probeModeChart && (
        <ProbeModeDialog
          isOpen={!!probeModeChart}
          onClose={() => setProbeModeChart(null)}
          chart={probeModeChart as any}
          dashboards={dashboards}
          projectId={projectId}
          onSaveAsDraft={handleProbeSaveAsDraft}
        />
      )}

    </>
  );
}
