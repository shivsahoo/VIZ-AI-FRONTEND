import { useState, useEffect, useRef } from "react";
import { Sparkles, X, ArrowUp, BarChart3, LineChart, PieChart, AreaChart, ChartScatter, Grid3x3, Funnel, Globe, ChevronDown, ChevronUp, Code, Database, Check, RotateCcw, Microscope, Eye, ChevronsUpDown } from "lucide-react";
import { ChartPreviewDialog } from "../charts/ChartPreviewDialog";
import { ProbeModeDialog } from "../charts/ProbeModeDialog";
import { getDashboards, getDatabases, getCurrentUser, getLatestOntology, type Chart as SavedChart } from "../../../services/api";
import { loadDatabaseMetadata, storeDatabaseMetadata, type DatabaseMetadataEntry } from "../../../utils/databaseMetadata";
import { VizAIWebSocket, WebSocketResponse, type ChartSpec } from "../../../services/websocket";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import "./AIAssistant.css";
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
  /** Question typed elsewhere (e.g. the home page) — pre-filled, not auto-sent. */
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
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

// Tone slot per chart family (see .tone-N in AppShell.css)
const chartTypeTone: Record<string, number> = {
  line: 0, stackedlinechart: 0, bar: 1, stackedhorizontalbar: 1, multiyaxischart: 1, funnel: 1,
  scatter: 2, clustering: 2, area: 3, pie: 4, donut: 4, heatmap: 4, map: 5,
};

const STARTER_PROMPTS = [
  "Show the monthly trend of our key metric",
  "Top 10 items by revenue",
  "Compare this year with last year",
  "Break down totals by category",
];

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

export function AIAssistant({ isOpen, onOpenChange, projectId, currentTab, onChartCreated, editingChart, initialPrompt, onInitialPromptConsumed }: AIAssistantProps) {
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

  useEffect(() => {
    if (isOpen && initialPrompt) {
      setInput(initialPrompt);
      onInitialPromptConsumed?.();
    }
  }, [isOpen, initialPrompt, onInitialPromptConsumed]);
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
          content: `You're connected to ${selectedDb?.label ?? "your data"}. What would you like to see?`
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
        // If the user previously generated charts in this session, pass the
        // last known state so the backend can restore conversation history
        // even if its in-memory session was lost (e.g. server restart).
        wsClient.chartCreation({
          ...payload,
          ...(chartWorkflowState ? { existing_state: chartWorkflowState } : {}),
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
        <DialogContent className="ai-dialog p-0 flex flex-col overflow-hidden gap-0" hideCloseButton={true}>
          {(() => {
            const currentDb = availableDatabases.find((db) => db.value === selectedDatabase || db.id === selectedDatabase);
            const connected = Boolean(wsClient && wsClient.isConnected());
            return (
              <DialogHeader className="ai-header shrink-0">
                <div className="ai-header-icon" aria-hidden="true">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <DialogTitle className="ai-title">VizAI Assistant</DialogTitle>
                  <p className="ai-subtitle">
                    <span className={`ai-status-dot${currentDb && connected ? " is-live" : ""}`} aria-hidden="true" />
                    {currentDb
                      ? `${connected ? "Connected to" : "Connecting to"} ${currentDb.label}`
                      : "Choose a data source to start"}
                  </p>
                </div>
                <button type="button" className="ai-icon-btn" onClick={() => onOpenChange(false)} aria-label="Close assistant">
                  <X className="w-5 h-5" />
                </button>
              </DialogHeader>
            );
          })()}

          {editingChart && (
            <div className="ai-editing shrink-0">
              <span className={`app-tile tone-${chartTypeTone[editingChart.type] ?? 0}`} aria-hidden="true">
                {(() => {
                  const Icon = chartTypeIcons[editingChart.type];
                  return <Icon className="w-[18px] h-[18px]" />;
                })()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="ai-editing-label">Editing chart · <span className="capitalize">{editingChart.type}</span></p>
                <p className="ai-editing-name">{editingChart.name}</p>
              </div>
              <p className="ai-editing-hint">Ask to change the type, data or styling.</p>
            </div>
          )}

          <div className="ai-thread flex-1 overflow-y-auto min-h-0">
            <div className="ai-thread-inner">
              {connectionError && (
                <div className="ai-error" role="alert">{connectionError}</div>
              )}
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: [0.28, 0.11, 0.32, 1] }}
                  >
                    {message.type === 'user' && (
                      <div className="ai-row ai-row--user">
                        <div className="ai-bubble ai-bubble--user">{message.content}</div>
                      </div>
                    )}

                    {(message.type === 'ai' || message.type === 'database-prompt') && (() => {
                      const { hasQuestions, parts } = parseQuestions(message.content);
                      return (
                        <div className="ai-row">
                          <span className="ai-avatar" aria-hidden="true"><Sparkles className="w-4 h-4" /></span>
                          <div className="ai-stack">
                            {hasQuestions ? (
                              parts.map((part, idx) =>
                                part.type === 'question' ? (
                                  <div key={idx} className="ai-question">
                                    <span className="ai-question-num">{part.questionNumber}</span>
                                    <p>{part.content}</p>
                                  </div>
                                ) : part.content ? (
                                  <div key={idx} className="ai-bubble">{part.content}</div>
                                ) : null,
                              )
                            ) : (
                              <div className="ai-bubble">{message.content}</div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {message.type === 'chart-suggestions' && (
                      <div className="ai-suggestions-block">
                        <div className="ai-row">
                          <span className="ai-avatar" aria-hidden="true"><Sparkles className="w-4 h-4" /></span>
                          <div className="ai-bubble">{message.content}</div>
                        </div>

                        {message.chartSuggestions && message.chartSuggestions.length > 0 && (
                          <>
                            <div className="ai-suggestions">
                              {message.chartSuggestions.map((suggestion, i) => {
                                const Icon = chartTypeIcons[suggestion.type] ?? BarChart3;
                                const isExpanded = expandedSuggestion === suggestion.id;
                                return (
                                  <motion.div
                                    key={suggestion.id}
                                    className={`ai-suggestion${isExpanded ? " is-expanded" : ""}`}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.35, delay: 0.05 * i, ease: [0.28, 0.11, 0.32, 1] }}
                                  >
                                    <div className="ai-suggestion-head">
                                      <span className={`app-tile tone-${chartTypeTone[suggestion.type] ?? 0}`} aria-hidden="true">
                                        <Icon className="w-[18px] h-[18px]" />
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <p className="ai-suggestion-name">{suggestion.name}</p>
                                        <span className="ai-suggestion-type">{suggestion.type}</span>
                                      </div>
                                    </div>
                                    <p className="ai-suggestion-desc">{suggestion.description}</p>

                                    {isExpanded && (
                                      <div className="ai-suggestion-details">
                                        {suggestion.reasoning && (
                                          <>
                                            <p className="ai-detail-label">Why this chart</p>
                                            <p className="ai-detail-text">{suggestion.reasoning}</p>
                                          </>
                                        )}
                                        {suggestion.query && (
                                          <>
                                            <p className="ai-detail-label">SQL</p>
                                            <pre className="ai-code"><code>{suggestion.query}</code></pre>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    <div className="ai-suggestion-actions">
                                      <button type="button" className="ai-btn ai-btn--primary" onClick={() => handleCreateChart(suggestion)}>
                                        <Eye className="w-4 h-4" aria-hidden="true" />
                                        Preview
                                      </button>
                                      {suggestion.query && (
                                        <button type="button" className="ai-btn" onClick={() => handleOpenProbeMode(suggestion)}>
                                          <Microscope className="w-4 h-4" aria-hidden="true" />
                                          Probe
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className="ai-btn ai-btn--ghost"
                                        onClick={() => toggleSuggestionExpand(suggestion.id)}
                                        aria-expanded={isExpanded}
                                      >
                                        <Code className="w-4 h-4" aria-hidden="true" />
                                        {isExpanded ? "Hide" : "Why & SQL"}
                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </button>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>

                            <div className="ai-center">
                              <button
                                type="button"
                                className="ai-btn"
                                onClick={handleRegenerateCharts}
                                disabled={isGenerating || !wsClient || !wsClient.isConnected()}
                              >
                                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                                Suggest different charts
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {(isGenerating || isSettingUp) && (
                <div className="ai-row" aria-live="polite">
                  <span className="ai-avatar" aria-hidden="true"><Sparkles className="w-4 h-4" /></span>
                  <div className="ai-bubble ai-typing">
                    <span /><span /><span />
                    {isGenerating && <em>Building your charts…</em>}
                  </div>
                </div>
              )}

              {showWelcomeScreen && messages.length > 0 && messages[0].type === 'ai' && (
                <div className="ai-center">
                  <button type="button" className="ai-btn ai-btn--primary ai-btn--lg" onClick={handleGetStarted}>
                    <Sparkles className="w-5 h-5" aria-hidden="true" />
                    Let's get started
                  </button>
                </div>
              )}

              {/* Data source picker — part of the conversation, not a footer chip */}
              {showDatabaseSelection && (
                <motion.div
                  className="ai-picker"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                >
                  <p className="ai-picker-title">
                    <Database className="w-4 h-4" aria-hidden="true" />
                    Choose a data source
                  </p>
                  {isLoadingDatabases ? (
                    <div className="ai-picker-grid">
                      {[0, 1].map((i) => <div key={i} className="home-skel" style={{ height: 64, borderRadius: 16 }} />)}
                    </div>
                  ) : availableDatabases.length === 0 ? (
                    <p className="ai-picker-empty">No database connections yet. Add one from the Databases page to start.</p>
                  ) : (
                    <div className="ai-picker-grid" role="radiogroup" aria-label="Data source">
                      {availableDatabases.map((db) => {
                        const active = selectedDatabase === db.value;
                        return (
                          <button
                            key={db.value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            className={`ai-source${active ? " is-active" : ""}`}
                            onClick={() => handleDatabaseSelect(db.value)}
                          >
                            <span className="ai-source-icon"><Database className="w-5 h-5" aria-hidden="true" /></span>
                            <span className="min-w-0 flex-1 text-left">
                              <span className="ai-source-name">{db.label}</span>
                              <span className="ai-source-type">{({ postgresql: "PostgreSQL", postgres: "PostgreSQL", mysql: "MySQL", mssql: "SQL Server", sqlserver: "SQL Server", snowflake: "Snowflake", bigquery: "BigQuery" } as Record<string, string>)[String(db.type || "").toLowerCase()] ?? (db.type || "Database")}</span>
                            </span>
                            <span className="ai-source-check" aria-hidden="true">{active && <Check className="w-3.5 h-3.5" />}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {selectedDatabase && !showWelcomeScreen && !showDatabaseSelection && !messages.some(m => m.type === 'chart-suggestions') && !isGenerating && (
                <motion.div className="ai-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
                  <button
                    type="button"
                    className="ai-auto"
                    onClick={handleRegenerateCharts}
                    disabled={!wsClient || !wsClient.isConnected()}
                  >
                    <span className="ai-auto-icon"><Sparkles className="w-5 h-5" aria-hidden="true" /></span>
                    <span className="text-left">
                      <span className="ai-auto-title">Let AI suggest charts</span>
                      <span className="ai-auto-sub">VizAI looks at your schema and proposes the most useful views.</span>
                    </span>
                  </button>
                  <p className="ai-or">or ask for something specific</p>
                  <div className="ai-prompts">
                    {STARTER_PROMPTS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="ai-prompt"
                        onClick={() => {
                          setInput(p);
                          inputRef.current?.focus();
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {selectedDatabase && !showWelcomeScreen && (
            <div className="ai-composer-wrap shrink-0">
              <div className={`ai-composer${isGenerating ? " is-busy" : ""}`}>
                <button
                  type="button"
                  className="ai-source-chip"
                  onClick={() => setShowDatabaseSelection(true)}
                  title="Change data source"
                >
                  <Database className="w-3.5 h-3.5" aria-hidden="true" />
                  {availableDatabases.find((db) => db.value === selectedDatabase || db.id === selectedDatabase)?.label ?? "Source"}
                  <ChevronsUpDown className="w-3 h-3 opacity-60" aria-hidden="true" />
                </button>
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
                  placeholder={editingChart ? "Describe the change…" : "Ask a question about your data…"}
                  aria-label="Message VizAI"
                  disabled={isGenerating}
                  autoFocus
                />
                <button
                  type="button"
                  className="ai-send"
                  onClick={handleSend}
                  aria-label="Send"
                  disabled={
                    !input.trim() ||
                    isGenerating ||
                    isConnecting ||
                    !selectedDatabase ||
                    !(wsClient && wsClient.isConnected())
                  }
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
              </div>
              <p className="ai-hint">
                {wsClient && wsClient.isConnected() ? "Press Enter to send" : isConnecting ? "Connecting…" : "Reconnecting to VizAI…"}
              </p>
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
