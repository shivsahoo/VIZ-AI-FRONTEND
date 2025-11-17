import { useState, useEffect, useRef } from "react";
import { Sparkles, X, Send, BarChart3, LineChart, PieChart, AreaChart, Plus, ChevronDown, ChevronUp, Code, Database, Check } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { GradientButton } from "../../shared/GradientButton";
import { ChartPreviewDialog } from "../charts/ChartPreviewDialog";
import { getDashboards, getDatabases, getCurrentUser, type Chart as SavedChart } from "../../../services/api";
import { loadDatabaseMetadata, storeDatabaseMetadata, type DatabaseMetadataEntry } from "../../../utils/databaseMetadata";
import { VizAIWebSocket, WebSocketResponse, type ChartSpec } from "../../../services/websocket";
import { toast } from "sonner";
import { AnimatePresence } from "framer-motion";

interface Message {
  id: number;
  type: 'user' | 'ai' | 'chart-suggestions' | 'database-prompt';
  content: string;
  chartSuggestions?: ChartSuggestion[];
}

interface ChartSuggestion {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  description: string;
  query: string;
  reasoning: string;
  dataSource?: string;
  dataConnectionId?: string;
  databaseId?: string;
  relevance?: number;
  spec?: ChartSpec;
}

type ChartCreationRequestPayload = {
  nlq_query: string;
  data_connection_id: string;
  db_schema: string;
  db_type: 'postgres' | 'mysql' | 'sqlite';
  role: string;
  kpi_info?: string;
  dashboard_kpi_info?: string;
  product_info?: string;
  conversation_summary?: string;
  min_max_dates?: [string, string];
  sample_data?: string;
};

interface AIAssistantProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  projectId?: number | string;
  onChartCreated?: (chart: {
    id?: string;
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number;
  }) => void;
  editingChart?: {
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    description?: string;
  } | null;
}

const chartTypeIcons = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  area: AreaChart
};

const chartTypeColors = {
  line: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  bar: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  pie: "bg-green-500/10 text-green-500 border-green-500/20",
  area: "bg-orange-500/10 text-orange-500 border-orange-500/20"
};

const mapDatabaseMetadataToAssistantState = (entry: DatabaseMetadataEntry) => ({
  id: entry.id,
  name: entry.name,
  type: entry.type || "postgresql",
  schema: entry.schema ?? null,
});

const normalizeChartType = (type?: string): 'line' | 'bar' | 'pie' | 'area' => {
  if (!type) return 'line';
  const lower = type.toLowerCase();
  if (lower.includes('bar')) return 'bar';
  if (lower.includes('pie') || lower.includes('donut')) return 'pie';
  if (lower.includes('area')) return 'area';
  return 'line';
};

const normalizeDbType = (type?: string): 'postgres' | 'mysql' | 'sqlite' => {
  if (!type) return 'postgres';
  const lower = type.toLowerCase();
  if (lower.includes('mysql')) return 'mysql';
  if (lower.includes('sqlite')) return 'sqlite';
  return 'postgres';
};

const ensureSchemaString = (schema?: string | null): string => {
  if (!schema) {
    return JSON.stringify({ tables: [] });
  }
  try {
    JSON.parse(schema);
    return schema;
  } catch (error) {
    console.warn('AIAssistant: Received invalid schema JSON, falling back to empty schema', { error });
    return JSON.stringify({ tables: [] });
  }
};

export function AIAssistant({ isOpen, onOpenChange, projectId, onChartCreated, editingChart }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'database-prompt',
      content: 'Hello! I\'m VizAI. To get started, please select which database you\'d like to generate charts from.'
    }
  ]);
  const [input, setInput] = useState("");
  const [selectedDatabase, setSelectedDatabase] = useState("");
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewChart, setPreviewChart] = useState<ChartSuggestion | null>(null);
  const [showDatabaseSelection, setShowDatabaseSelection] = useState(true);
  const [dashboards, setDashboards] = useState<Array<{ id: string | number; name: string }>>([]);
  const [databases, setDatabases] = useState<Array<{ id: string; name: string; type: string; schema?: string | null }>>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false);
  const [wsClient, setWsClient] = useState<VizAIWebSocket | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const chartRequestRef = useRef<ChartCreationRequestPayload | null>(null);
  const [isAwaitingClarification, setIsAwaitingClarification] = useState(false);
  const [chartWorkflowState, setChartWorkflowState] = useState<Record<string, any> | null>(null);

  const replaceAnalyzingMessage = (content: string) => {
    setMessages((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: 1,
            type: 'ai',
            content,
          },
        ];
      }

      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        const message = updated[i];
        if (message.type === 'ai' && message.content === 'Analyzing your request and generating chart suggestions...') {
          updated[i] = { ...message, content };
          return updated;
        }
      }

      return [
        ...updated,
        {
          id: prev.length + 1,
          type: 'ai',
          content,
        },
      ];
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

  // Fetch dashboards and databases when projectId is available
  useEffect(() => {
    if (projectId && isOpen) {
      fetchDashboards();
      fetchDatabases();
    }
  }, [projectId, isOpen]);

  useEffect(() => {
    if (!isOpen || !userId) {
      return;
    }

    const client = new VizAIWebSocket(userId);
    setIsConnecting(true);
    setConnectionError(null);

    const handleChartCreation = (response: WebSocketResponse) => {
      // Helper function to remove analyzing message
      const removeAnalyzingMessage = () => {
        setMessages((prev) => {
          return prev.filter(
            (msg) => !(msg.type === 'ai' && msg.content === 'Analyzing your request and generating chart suggestions...')
          );
        });
      };

      // Update quick suggestions from clarity questions if present
      const clarityQs = Array.isArray(response.state?.clarity_questions)
        ? (response.state?.clarity_questions as string[])
        : [];
      if (clarityQs.length > 0) {
        setDynamicSuggestions(clarityQs.slice(0, 3));
      }

      // Helper function to process and display chart specs
      const processChartSpecs = (chartSpecs: ChartSpec[], message?: string) => {
        if (!chartSpecs.length) {
          const errorMessage = message || "I couldn't find any relevant charts based on that request. Try rephrasing or providing more detail.";
          removeAnalyzingMessage();
          setMessages((prev) => [
            ...prev,
            {
              id: prev.length + 1,
              type: 'ai',
              content: errorMessage
            }
          ]);
          return;
        }

        const suggestions: ChartSuggestion[] = chartSpecs.map((spec, index) => {
          const chartType = normalizeChartType(spec.chart_type);
          return {
            id: `${spec.data_connection_id || 'chart'}-${index}-${Date.now()}`,
            name: spec.title || `Generated Chart ${index + 1}`,
            type: chartType,
            description: spec.report || spec.title || "AI-generated chart suggestion",
            query: spec.query,
            reasoning: spec.report || "Generated based on your request.",
            dataSource: spec.data_connection_id ? `Database ${spec.data_connection_id}` : undefined,
            dataConnectionId: spec.data_connection_id,
            databaseId: spec.data_connection_id,
            relevance: typeof spec.relevance === 'number' ? spec.relevance : undefined,
            spec,
          };
        });

        // If no clarity questions, derive suggestions from chart titles/reports
        if (clarityQs.length === 0 && suggestions.length > 0) {
          const qs = suggestions
            .map(s => s.name || s.description || '')
            .filter(Boolean)
            .slice(0, 3);
          if (qs.length > 0) setDynamicSuggestions(qs);
        }

        const contentMessage = message || `I've analyzed your request and generated ${suggestions.length} chart suggestion${suggestions.length > 1 ? 's' : ''}.`;
        
        // Remove analyzing message and add chart suggestions
        removeAnalyzingMessage();
        setMessages((prev) => [
          ...prev,
          {
            id: prev.length + 1,
            type: 'chart-suggestions',
            content: contentMessage,
            chartSuggestions: suggestions,
          },
        ]);
      };

      if (response.status === 'collecting') {
        setIsGenerating(false);
        setIsAwaitingClarification(true);
        setChartWorkflowState(response.state ?? null);
        
        // Check if chart_specs are provided even when status is 'collecting'
        const chartSpecs = (response.state?.chart_specs as ChartSpec[]) || [];
        
        if (chartSpecs.length > 0) {
          // If we have chart specs, display them
          const message = response.message || "Here are a few starter charts for this data source.";
          processChartSpecs(chartSpecs, message);
        } else {
          // No chart specs, just show clarification message
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
        
        processChartSpecs(chartSpecs, response.message);
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

    client.on('chart_creation', handleChartCreation);
    client.onError((error) => {
      console.error('[AIAssistant] WebSocket error:', error);
      setIsGenerating(false);
      setConnectionError(error.message || 'WebSocket connection error');
      toast.error('Connection lost. Please try again.');
    });

    client.connect()
      .then(() => {
        setWsClient(client);
        setIsConnecting(false);
      })
      .catch((error) => {
        console.error('[AIAssistant] Failed to connect to WebSocket:', error);
        setIsConnecting(false);
        setConnectionError(error?.message || 'Failed to connect to AI assistant');
        toast.error(error?.message || 'Failed to connect to AI assistant');
      });

    return () => {
      client.off('chart_creation', handleChartCreation);
      client.disconnect();
      setWsClient(null);
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
      console.log('AIAssistant: Fetching dashboards for projectId:', projectId);
      const response = await getDashboards(String(projectId));
      console.log('AIAssistant: getDashboards response:', response);
      
      if (response.success && response.data && Array.isArray(response.data)) {
        const fetchedDashboards = response.data.map(d => ({ id: d.id, name: d.name }));
        setDashboards(fetchedDashboards);
        console.log('AIAssistant: Fetched dashboards successfully', { count: fetchedDashboards.length, dashboards: fetchedDashboards });
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
        console.log('AIAssistant: Fetched databases', { count: fetchedDatabases.length, databases: fetchedDatabases });
        
        if (fetchedDatabases.length === 0) {
          toast.info("No database connections found. Please add a database connection first.");
        }
      } else {
        toast.error(response.error?.message || "Failed to fetch database connections");
        console.error("Failed to fetch databases:", response.error);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch database connections");
      console.error("Failed to fetch databases:", err);
    } finally {
      setIsLoadingDatabases(false);
    }
  };

  // Update initial message when editing a chart
  useEffect(() => {
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
    } else if (!editingChart && isOpen) {
      // Reset to initial state when not editing
      setMessages([
        {
          id: 1,
          type: 'database-prompt',
          content: 'Hello! I\'m VizAI. To get started, please select which database you\'d like to generate charts from.'
        }
      ]);
      setShowDatabaseSelection(true);
      setSelectedDatabase('');
    }
  }, [editingChart, isOpen]);

  // Use fetched databases if available, otherwise fall back to mock databases
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
    
    // Add user selection message
    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: `Selected: ${selectedDb?.label}`
    };
    
    // Push user selection to the chat
    setMessages(prev => [...prev, userMessage]);
    setShowDatabaseSelection(false);

    // Kick off chart_creation workflow immediately after DB selection per contract
    const dbId = selectedDb?.id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealDatabase = dbId && uuidRegex.test(String(dbId));

    if (wsClient && wsClient.isConnected() && isRealDatabase) {
      // Show analyzing message and send request
      setIsGenerating(true);
      setMessages(prev => ([
        ...prev,
        { id: prev.length + 1, type: 'ai', content: 'Analyzing your request and generating chart suggestions...' }
      ]));

      wsClient.send({
        event_type: 'chart_creation',
        user_id: userId!,
        payload: {
          data_connection_id: String(dbId),
          role: 'Analyst',
          domain: 'admin',
          project_id: projectId || undefined,
          suggestion_count: 3,
        },
      });
    }
  };

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    // If no database selected, prompt the user to choose one
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
    if (!selectedDb.schema) {
      toast.warning("Schema details for this database are unavailable. Chart quality may be limited.");
    }

    const isClarificationResponse = isAwaitingClarification && chartRequestRef.current !== null;

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
    if (!isClarificationResponse) {
      setIsAwaitingClarification(false);
      setChartWorkflowState(null);
    }

    const payload: ChartCreationRequestPayload = isClarificationResponse && chartRequestRef.current
      ? { ...chartRequestRef.current }
      : {
          nlq_query: trimmedInput,
          data_connection_id: String(selectedDb.id),
          db_schema: schemaString,
          db_type: normalizeDbType(selectedDb.type),
          role: 'Analyst',
        };

    if (!isClarificationResponse) {
      chartRequestRef.current = { ...payload };
    }

    try {
      wsClient.chartCreation({
        ...payload,
        ...(isClarificationResponse
          ? {
              user_response: trimmedInput,
              existing_state: chartWorkflowState ?? undefined,
              continue_workflow: true,
            }
          : {}),
      });
      if (isClarificationResponse) {
        setIsAwaitingClarification(false);
      }
    } catch (error: any) {
      console.error('[AIAssistant] Failed to send chart creation request:', error);
      setIsGenerating(false);
      toast.error(error?.message || 'Failed to submit your request. Please try again.');
    }
  };

  const handleCreateChart = (suggestion: ChartSuggestion) => {
    // Find the selected database and format dataSource with database ID
    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);
    
    if (!selectedDb || !selectedDb.id) {
      toast.error("Please select a valid database connection first.");
      return;
    }
    
    // If it's a real database (UUID), validate it; otherwise use mock value
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isRealDatabase = uuidRegex.test(selectedDb.id);
    
    if (!isRealDatabase && databases.length > 0) {
      // If we have real databases but selected a mock one, show error
      toast.error("Please select a valid database connection from the list.");
      return;
    }
    
    // Format dataSource as "Database {id}" so ChartPreviewDialog can extract it
    const chartWithDataSource: ChartSuggestion = {
      ...suggestion,
      dataSource: `Database ${selectedDb.id}`,
      dataConnectionId: suggestion.dataConnectionId || selectedDb.id,
      databaseId: suggestion.dataConnectionId || selectedDb.id,
    };
    
    // Open preview dialog instead of creating immediately
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
      dataSource: `Database ${selectedDb.id}`, // Format: "Database {uuid}" for extraction
      query: previewChart.query,
      status: 'draft'
    });
    
    // Remove the suggestion from the message
    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.type === 'chart-suggestions' && msg.chartSuggestions) {
          return {
            ...msg,
            chartSuggestions: msg.chartSuggestions.filter(s => s.id !== previewChart.id)
          };
        }
        return msg;
      })
    );

    // Close preview
    setPreviewChart(null);
  };

  const handleAddChartToDashboard = (dashboardId: number | string) => {
    if (!previewChart) return;

    const selectedDb = availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase);
    
    if (!selectedDb || !selectedDb.id) {
      toast.error("Database connection is required");
      return;
    }
    
    if (onChartCreated) {
      onChartCreated({
        name: previewChart.name,
        type: previewChart.type,
        dataSource: `Database ${selectedDb.id}`, // Format: "Database {uuid}" for extraction
        query: previewChart.query,
        status: 'published',
          dashboardId: typeof dashboardId === 'string' ? (isNaN(Number(dashboardId)) ? undefined : Number(dashboardId)) : dashboardId
      });
    }
    
    // Remove the suggestion from the message
    setMessages(prevMessages => 
      prevMessages.map(msg => {
        if (msg.type === 'chart-suggestions' && msg.chartSuggestions) {
          return {
            ...msg,
            chartSuggestions: msg.chartSuggestions.filter(s => s.id !== previewChart.id)
          };
        }
        return msg;
      })
    );

    // Close preview
    setPreviewChart(null);
  };

  const toggleSuggestionExpand = (id: string) => {
    setExpandedSuggestion(expandedSuggestion === id ? null : id);
  };

  const handleChangeDatabase = () => {
    setShowDatabaseSelection(true);
    const aiMessage: Message = {
      id: messages.length + 1,
      type: 'database-prompt',
      content: 'Sure! Which database would you like to switch to?'
    };
    setMessages(prev => [...prev, aiMessage]);
  };

  const suggestions = dynamicSuggestions.length > 0
    ? dynamicSuggestions
    : [
    "I want reports on finance data for last financial year",
    "Show me sales trends for Q4",
    "Customer demographics breakdown"
  ];

  return (
    <>
      {/* Slide-in Panel */}
      <div 
        className={`h-full bg-card border-l border-border shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
          isOpen ? 'w-[480px]' : 'w-0'
        }`}
        style={{ 
          overflow: isOpen ? 'visible' : 'hidden'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-primary to-accent border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-white">Ask VizAI</h3>
              {selectedDatabase ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-white/80 truncate">
                    {availableDatabases.find(db => db.value === selectedDatabase || db.id === selectedDatabase)?.label || selectedDatabase}
                  </p>
                  <button
                    onClick={handleChangeDatabase}
                    className="text-xs text-white/90 hover:text-white underline underline-offset-2 flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <p className="text-xs text-white/80">AI-powered chart generation</p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="text-white hover:bg-white/20 h-9 w-9 flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Editing Chart Context Banner */}
        {editingChart && (
          <div className="p-4 bg-muted/50 border-b border-border shrink-0">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 bg-muted/20">
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

              {(message.type === 'ai' || message.type === 'database-prompt') && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-card border border-border text-foreground">
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              )}

              {message.type === 'chart-suggestions' && (
                <div className="space-y-3">
                  <div className="flex justify-start">
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
                                  <Plus className="w-4 h-4" />
                                  Create
                                </GradientButton>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          </AnimatePresence>

          {isGenerating && (
            <div className="flex justify-start">
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

          {/* Suggestions */}
          {messages.length <= 4 && selectedDatabase && !messages.some(m => m.type === 'chart-suggestions') && !editingChart && dynamicSuggestions.length > 0 && (
            <div className="space-y-2 pt-4">
              <p className="text-xs text-muted-foreground px-2">Try asking:</p>
              {suggestions.map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(suggestion)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-accent hover:bg-accent/5 transition-all text-sm text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Database Selection (Above Input) */}
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
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                      selectedDatabase === db.value
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

        {/* Input - Only show after database is selected */}
        {selectedDatabase && (
          <div className="p-6 border-t border-border bg-card shrink-0">
            <div className="flex gap-3">
              <input
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
                className="flex-1 px-4 py-3 bg-input-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
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
      </div>

      {/* Chart Preview Dialog */}
      <ChartPreviewDialog
        isOpen={!!previewChart}
        onClose={() => setPreviewChart(null)}
        chart={previewChart}
          projectId={projectId}
          dashboards={dashboards}
        onAddToDashboard={handleAddChartToDashboard}
        onSaveAsDraft={handleSaveAsDraft}
      />

    </>
  );
}
