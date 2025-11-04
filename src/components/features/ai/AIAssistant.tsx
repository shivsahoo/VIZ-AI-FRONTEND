import { useState, useEffect } from "react";
import { Sparkles, X, Send, BarChart3, LineChart, PieChart, AreaChart, Plus, ChevronDown, ChevronUp, Code, Database, Check } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { GradientButton } from "../../shared/GradientButton";
import { ChartPreviewDialog } from "../charts/ChartPreviewDialog";

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
}

interface AIAssistantProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onChartCreated?: (chart: {
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

export function AIAssistant({ isOpen, onOpenChange, onChartCreated, editingChart }: AIAssistantProps) {
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

  // Mock database connections
  const databases = [
    { value: "sales-db", label: "Sales Database" },
    { value: "inventory-db", label: "Inventory DB" },
    { value: "analytics-db", label: "Analytics DB" },
    { value: "customer-db", label: "Customer DB" },
    { value: "marketing-db", label: "Marketing DB" }
  ];

  const handleDatabaseSelect = (dbValue: string) => {
    setSelectedDatabase(dbValue);
    const selectedDb = databases.find(db => db.value === dbValue);
    
    // Add user selection message
    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: `Selected: ${selectedDb?.label}`
    };
    
    // Add AI confirmation
    const aiMessage: Message = {
      id: messages.length + 2,
      type: 'ai',
      content: `Great! I'll help you create charts from your ${selectedDb?.label}. What kind of data visualization do you need?`
    };
    
    setMessages(prev => [...prev, userMessage, aiMessage]);
    setShowDatabaseSelection(false);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    // If no database selected, show prompt
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

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: input
    };

    setMessages([...messages, userMessage]);
    const currentInput = input;
    setInput("");
    setIsGenerating(true);

    // Simulate AI processing and chart generation
    setTimeout(() => {
      const mockSuggestions: ChartSuggestion[] = [
        {
          id: `cs-${Date.now()}-1`,
          name: "Financial Performance Overview",
          type: "line",
          description: "Revenue and expenses trend for the last financial year",
          query: "SELECT \n  DATE_TRUNC('month', transaction_date) as month,\n  SUM(CASE WHEN type = 'revenue' THEN amount ELSE 0 END) as revenue,\n  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses\nFROM financial_transactions\nWHERE transaction_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)\nGROUP BY month\nORDER BY month ASC;",
          reasoning: `Based on your request "${currentInput}", this chart shows revenue vs expenses trends over the last fiscal year.`
        },
        {
          id: `cs-${Date.now()}-2`,
          name: "Expense Breakdown by Category",
          type: "pie",
          description: "Distribution of expenses across different categories",
          query: "SELECT \n  expense_category,\n  SUM(amount) as total_expense\nFROM financial_transactions\nWHERE type = 'expense'\n  AND transaction_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)\nGROUP BY expense_category;",
          reasoning: "This pie chart helps visualize where the money is being spent across different expense categories."
        },
        {
          id: `cs-${Date.now()}-3`,
          name: "Quarterly Revenue Comparison",
          type: "bar",
          description: "Compare revenue performance across quarters",
          query: "SELECT \n  CONCAT('Q', QUARTER(transaction_date), ' ', YEAR(transaction_date)) as quarter,\n  SUM(amount) as revenue\nFROM financial_transactions\nWHERE type = 'revenue'\n  AND transaction_date >= DATE_SUB(CURRENT_DATE, INTERVAL 12 MONTH)\nGROUP BY quarter\nORDER BY MIN(transaction_date);",
          reasoning: "Bar chart for comparing quarterly performance makes it easy to spot trends and seasonal patterns."
        }
      ];

      const aiMessage: Message = {
        id: messages.length + 2,
        type: 'chart-suggestions',
        content: `I've analyzed your request and generated ${mockSuggestions.length} chart suggestions. You can review the SQL queries and create the ones you need.`,
        chartSuggestions: mockSuggestions
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsGenerating(false);
    }, 2000);
  };

  const handleCreateChart = (suggestion: ChartSuggestion) => {
    // Open preview dialog instead of creating immediately
    setPreviewChart(suggestion);
  };

  const handleSaveAsDraft = () => {
    if (!previewChart) return;

    const selectedDb = databases.find(db => db.value === selectedDatabase);
    
    if (onChartCreated) {
      onChartCreated({
        name: previewChart.name,
        type: previewChart.type,
        dataSource: selectedDb?.label || "Unknown",
        query: previewChart.query,
        status: 'draft'
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

  const handleAddChartToDashboard = (dashboardId: number) => {
    if (!previewChart) return;

    const selectedDb = databases.find(db => db.value === selectedDatabase);
    
    if (onChartCreated) {
      onChartCreated({
        name: previewChart.name,
        type: previewChart.type,
        dataSource: selectedDb?.label || "Unknown",
        query: previewChart.query,
        status: 'published',
        dashboardId: dashboardId
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

  const suggestions = [
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
                    {databases.find(db => db.value === selectedDatabase)?.label}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-background">
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
          {messages.length <= 4 && selectedDatabase && !messages.some(m => m.type === 'chart-suggestions') && !editingChart && (
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
              <div className="flex flex-wrap gap-2">
                {databases.map((db) => (
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
            </div>
          </div>
        )}

        {/* Input - Only show after database is selected */}
        {selectedDatabase && (
          <div className="p-6 border-t border-border bg-card shrink-0">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isGenerating && handleSend()}
                placeholder="Describe the charts you need..."
                disabled={isGenerating}
                className="flex-1 px-4 py-3 bg-input-background border border-border rounded-lg outline-none focus:ring-2 focus:ring-accent text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50"
              />
              <GradientButton
                onClick={handleSend}
                disabled={!input.trim() || isGenerating}
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
        onAddToDashboard={handleAddChartToDashboard}
        onSaveAsDraft={handleSaveAsDraft}
      />

    </>
  );
}
