import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  AlertTriangle,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  LineChart,
  Loader2, 
  Sparkles, 
  Target,
  Database,
  Download,
  Copy,
  Check,
  Pin,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  generateProjectInsights, 
  generateBusinessInsights,
  getDatabases,
  saveHomeInsight,
  type ProjectInsightsResponse,
  type BusinessInsightsResponse,
  type Database as ApiDatabase,
} from "../services/api";
import { loadDatabaseMetadata, storeDatabaseMetadata, type DatabaseMetadataEntry } from "../utils/databaseMetadata";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import "./InsightsView.css";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";

interface Insight {
  id: string;
  title: string;
  description: string;
  type: "positive" | "negative" | "opportunity";
  category: string;
  timestamp: string;
  impact: "High" | "Medium" | "Low";
  source?: string; // Database name or "Project-wide"
}

interface InsightsViewProps {
  projectId?: string | number;
  onGeneratingChange?: (generating: boolean) => void;
}

const mapDatabaseMetadataToApiDatabase = (entry: DatabaseMetadataEntry): ApiDatabase => ({
  id: entry.id,
  name: entry.name,
  type: (entry.type as ApiDatabase["type"]) || "postgresql",
  host: "",
  port: 0,
  database: "",
  username: "",
  status: "connected",
  lastChecked: new Date().toISOString(),
  schema: entry.schema ?? null,
  connectionString: null,
  consentGiven: undefined,
});

export function InsightsView({ projectId, onGeneratingChange }: InsightsViewProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const onGeneratingChangeRef = useRef(onGeneratingChange);
  onGeneratingChangeRef.current = onGeneratingChange;

  // Notify parent whenever the generating state changes so it can disable the sidebar.
  useEffect(() => {
    onGeneratingChangeRef.current?.(isGenerating);
  }, [isGenerating]);
  const [databases, setDatabases] = useState<ApiDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("all");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [filteredInsights, setFilteredInsights] = useState<Insight[]>([]);
  const [copiedInsightId, setCopiedInsightId] = useState<string | null>(null);

  const insightStats = useMemo(() => {
    const stats = {
      total: insights.length,
      positive: 0,
      negative: 0,
      opportunity: 0,
      anomalies: 0,
    };

    insights.forEach((insight) => {
      if (insight.type === "positive") {
        stats.positive += 1;
      }
      if (insight.type === "negative") {
        stats.negative += 1;
        if (insight.impact === "High") {
          stats.anomalies += 1;
        }
      }
      if (insight.type === "opportunity") {
        stats.opportunity += 1;
      }
    });

    return stats;
  }, [insights]);

  type FilterOption = {
    value: string;
    label: string;
    count?: number;
    filterFn: (items: Insight[]) => Insight[];
  };

  const filterOptions = useMemo<FilterOption[]>(() => {
    const options: FilterOption[] = [
      {
        value: "all",
        label: "All Insights",
        count: insightStats.total,
        filterFn: (items) => items,
      },
    ];

    if (insightStats.total > 0) {
      options.push({
        value: "recent",
        label: "Recent",
        count: Math.min(10, insightStats.total),
        filterFn: (items) => items.slice(0, 10),
      });
    }

    if (insightStats.opportunity > 0) {
      options.push({
        value: "opportunity",
        label: "Opportunities",
        count: insightStats.opportunity,
        filterFn: (items) => items.filter((item) => item.type === "opportunity"),
      });
    }

    if (insightStats.positive > 0) {
      options.push({
        value: "positive",
        label: "Positive Trends",
        count: insightStats.positive,
        filterFn: (items) => items.filter((item) => item.type === "positive"),
      });
    }

    if (insightStats.negative > 0) {
      options.push({
        value: "negative",
        label: "Requires Attention",
        count: insightStats.negative,
        filterFn: (items) => items.filter((item) => item.type === "negative"),
      });
    }

    if (insightStats.anomalies > 0) {
      options.push({
        value: "anomalies",
        label: "Critical Anomalies",
        count: insightStats.anomalies,
        filterFn: (items) =>
          items.filter((item) => item.type === "negative" && item.impact === "High"),
      });
    }

    return options;
  }, [insightStats]);

  useEffect(() => {
    if (filterOptions.length === 0) {
      setFilteredInsights([]);
      return;
    }

    const currentFilter = filterOptions.find((option) => option.value === activeFilter);

    if (!currentFilter) {
      setActiveFilter(filterOptions[0].value);
      return;
    }

    setFilteredInsights(currentFilter.filterFn(insights));
  }, [filterOptions, activeFilter, insights]);

  const fetchDatabases = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const response = await getDatabases(String(projectId));
      if (response.success && response.data) {
        // Backend returns all databases for the project
        setDatabases(response.data);
        const metadataEntries: DatabaseMetadataEntry[] = response.data.map((db) => ({
          id: db.id,
          name: db.name,
          type: db.type,
          schema: db.schema ?? null,
        }));
        storeDatabaseMetadata(String(projectId), metadataEntries);
      } else if (response.error) {
        console.error("Failed to fetch databases:", response.error);
        // Show user-friendly message if no databases found
        if (response.error.message?.includes("No database connections")) {
          toast.info("No database connections found. Please add a database connection first.");
        }
      }
    } catch (error) {
      console.error("Failed to fetch databases:", error);
    }
  }, [projectId]);

  // Fetch databases when projectId is available
  useEffect(() => {
    if (!projectId) {
      return;
    }

    const cachedDatabases = loadDatabaseMetadata(String(projectId));
    if (cachedDatabases && cachedDatabases.length > 0) {
      setDatabases(cachedDatabases.map(mapDatabaseMetadataToApiDatabase));
    }

    fetchDatabases();
  }, [projectId, fetchDatabases]);


  // Reset selected database to "all" when dialog opens
  useEffect(() => {
    if (showGenerateDialog) {
      setSelectedDatabase("all");
      // Refresh databases when dialog opens
      if (projectId) {
        fetchDatabases();
      }
    }
  }, [showGenerateDialog, projectId, fetchDatabases]);

  const classifyKeyMetricType = (metric: any): Insight["type"] => {
    const trendRaw = metric?.trend;
    const trend = typeof trendRaw === "string" ? trendRaw.toLowerCase() : trendRaw;
    if (trend === "positive") return "positive";
    if (trend === "negative") return "negative";
    if (trend === "neutral") return "negative";

    // Fallback (handles cases like "not good" / "not improving")
    const valueInterpretation = String(metric?.value_interpretation || "");
    const lower = valueInterpretation.toLowerCase();

    const hasPositive = [/\bgood\b/, /\bexcellent\b/, /\bimprov\w*\b/].some((re) =>
      re.test(lower)
    );
    const hasNegative = [
      /\bpoor\b/,
      /\bworse\b/,
      /\bdeclin\w*\b/,
      /\bdecreas\w*\b/,
      /\bdeteriorat\w*\b/,
      /\bunderperform\w*\b/,
      /\bnegative\b/,
      /\bdrop\b/,
      /\bdown\b/,
    ].some((re) => re.test(lower));

    const negatesPositive = [
      /\bnot\s+good\b/,
      /\bnot\s+excellent\b/,
      /\bnot\s+improv\w*\b/,
      /\bno\s+longer\s+improv\w*\b/,
    ].some((re) => re.test(lower));

    // If there are clear negative signals, prefer `negative` to avoid mislabeling issues as good.
    if (hasNegative) return "negative";
    if (hasPositive && !negatesPositive) return "positive";

    // Default to negative when unclear/mixed to avoid false positives.
    return "negative";
  };

  const transformProjectInsights = (data: ProjectInsightsResponse): Insight[] => {
    try {
      // Separate arrays to maintain exact order
      const opportunities: Insight[] = [];
      const insightsAndPatterns: Insight[] = [];
      const recommendations: Insight[] = [];
      const strategicPriorities: Insight[] = [];
      const rest: Insight[] = [];
      let idCounter = 1;

    // 1. OPPORTUNITIES (First Priority) - from consolidated_insights.opportunities only
    if (data.consolidated_insights) {
      const consolidated = data.consolidated_insights;
      
      consolidated.opportunities?.forEach((opportunity) => {
        try {
          const title = String(opportunity?.title || 'Untitled Opportunity');
          const baseDescription = String(opportunity?.description || '');
          const potentialImpact = String(opportunity?.potential_impact || '');
          const reasoning = (opportunity as any)?.reasoning;
          const descriptionWithImpact = potentialImpact
            ? `${baseDescription} - Potential Impact: ${potentialImpact}`
            : baseDescription;
          const description = formatWithReasoning(descriptionWithImpact, reasoning);
          opportunities.push({
            id: `opportunity-${idCounter++}`,
            title: title,
            description: description,
            type: "opportunity",
            category: "Opportunity",
            timestamp: "Just now",
            impact: "Medium",
            source: "Project-wide",
          });
        } catch (err) {
          console.error("Error processing opportunity:", err, opportunity);
        }
      });
    }

    // 2. INSIGHTS_AND_PATTERNS (Second Priority)
    // First from database insights (insights_and_patterns)
    data.database_insights?.forEach((dbInsight) => {
      if (dbInsight.insights) {
        const insights = dbInsight.insights;
        
        insights.insights_and_patterns?.forEach((patternItem) => {
          try {
            const insightText = typeof patternItem === 'string' 
              ? patternItem 
              : (patternItem as any)?.insight || '';
            const reasoning = typeof patternItem === 'string' 
              ? '' 
              : (patternItem as any)?.reasoning || '';
            
            if (!insightText || typeof insightText !== 'string') {
              return;
            }
            
            const description = formatWithReasoning(insightText, reasoning);
            
            insightsAndPatterns.push({
              id: `pattern-${dbInsight.database_id}-${idCounter++}`,
              title: insightText.substring(0, 60) + (insightText.length > 60 ? "..." : ""),
              description: description,
              type: "opportunity",
              category: "Pattern",
              timestamp: "Just now",
              impact: "Medium",
              source: dbInsight.database_name || "Unknown",
            });
          } catch (err) {
            console.error("Error processing insight pattern:", err, patternItem);
          }
        });
      }
    });

    // Then from consolidated insights (cross_database_patterns)
    if (data.consolidated_insights) {
      const consolidated = data.consolidated_insights;
      consolidated.cross_database_patterns?.forEach((patternItem) => {
        try {
          const patternText = typeof patternItem === 'string' 
            ? patternItem 
            : (patternItem as any)?.pattern || '';
          const reasoning = typeof patternItem === 'string' 
            ? '' 
            : (patternItem as any)?.reasoning || '';
          
          if (!patternText || typeof patternText !== 'string') {
            return;
          }
          
          const description = formatWithReasoning(patternText, reasoning);
          
          insightsAndPatterns.push({
            id: `cross-pattern-${idCounter++}`,
            title: patternText.substring(0, 60) + (patternText.length > 60 ? "..." : ""),
            description: description,
            type: "opportunity",
            category: "Cross-Database Pattern",
            timestamp: "Just now",
            impact: "Medium",
            source: "Project-wide",
          });
        } catch (err) {
          console.error("Error processing cross-database pattern:", err, patternItem);
        }
      });
    }

    // 3. RECOMMENDATIONS (Third Priority) - from database_insights[].insights.recommendations ONLY
    data.database_insights?.forEach((dbInsight) => {
      if (dbInsight.insights) {
        const insights = dbInsight.insights;
        
        insights.recommendations?.forEach((rec) => {
          try {
            const title = String(rec?.title || 'Untitled Recommendation');
            const description = formatWithReasoning(
              String(rec?.description || ''),
              (rec as any)?.reasoning
            );
            recommendations.push({
              id: `rec-${dbInsight.database_id}-${idCounter++}`,
              title: title,
              description: description,
              type: rec.priority === "high" ? "opportunity" : "positive",
              category: "Recommendation",
              timestamp: "Just now",
              impact: rec.priority === "high" ? "High" : rec.priority === "medium" ? "Medium" : "Low",
              source: dbInsight.database_name || "Unknown",
            });
          } catch (err) {
            console.error("Error processing recommendation:", err, rec);
          }
        });
      }
    });

    // Strategic Priorities - separate from recommendations, goes in rest section
    if (data.consolidated_insights) {
      const consolidated = data.consolidated_insights;
      consolidated.strategic_priorities?.forEach((priority) => {
        try {
          const title = String(priority?.title || 'Untitled Priority');
          const description = formatWithReasoning(
            String(priority?.description || ''),
            (priority as any)?.reasoning
          );
          strategicPriorities.push({
            id: `priority-${idCounter++}`,
            title: title,
            description: description,
            type: "opportunity",
            category: "Strategic Priority",
            timestamp: "Just now",
            impact: priority.impact === "high" ? "High" : priority.impact === "medium" ? "Medium" : "Low",
            source: "Project-wide",
          });
        } catch (err) {
          console.error("Error processing strategic priority:", err, priority);
        }
      });
    }

    // 4. REST (Everything else - strategic priorities, risks, concerns, metrics)
    // Strategic priorities first in rest section
    rest.push(...strategicPriorities);

    // Consolidated risks
    if (data.consolidated_insights) {
      const consolidated = data.consolidated_insights;
      
      consolidated.risk_assessment?.critical_risks?.forEach((riskItem) => {
        try {
          const riskText = typeof riskItem === 'string' 
            ? riskItem 
            : (riskItem as any)?.risk || '';
          const reasoning = typeof riskItem === 'string' 
            ? '' 
            : (riskItem as any)?.reasoning || '';
          
          if (!riskText || typeof riskText !== 'string') {
            return;
          }
          
          const description = formatWithReasoning(
            `Critical risk identified: ${riskText}`,
            reasoning
          );
          
          rest.push({
            id: `risk-critical-${idCounter++}`,
            title: riskText,
            description: description,
            type: "negative",
            category: "Risk",
            timestamp: "Just now",
            impact: "High",
            source: "Project-wide",
          });
        } catch (err) {
          console.error("Error processing critical risk:", err, riskItem);
        }
      });

      consolidated.risk_assessment?.moderate_risks?.forEach((riskItem) => {
        try {
          const riskText = typeof riskItem === 'string' 
            ? riskItem 
            : (riskItem as any)?.risk || '';
          const reasoning = typeof riskItem === 'string' 
            ? '' 
            : (riskItem as any)?.reasoning || '';
          
          if (!riskText || typeof riskText !== 'string') {
            return;
          }
          
          const description = formatWithReasoning(
            `Moderate risk identified: ${riskText}`,
            reasoning
          );
          
          rest.push({
            id: `risk-moderate-${idCounter++}`,
            title: riskText,
            description: description,
            type: "negative",
            category: "Risk",
            timestamp: "Just now",
            impact: "Medium",
            source: "Project-wide",
          });
        } catch (err) {
          console.error("Error processing moderate risk:", err, riskItem);
        }
      });
    }

    // Database-specific rest items
    data.database_insights?.forEach((dbInsight) => {
      if (dbInsight.insights) {
        const insights = dbInsight.insights;
        
        insights.areas_of_concern?.forEach((concernItem) => {
          try {
            const concernText = typeof concernItem === 'string' 
              ? concernItem 
              : (concernItem as any)?.concern || '';
            const reasoning = typeof concernItem === 'string' 
              ? '' 
              : (concernItem as any)?.reasoning || '';
            
            if (!concernText || typeof concernText !== 'string') {
              return;
            }
            
            const description = formatWithReasoning(
              `Area requiring attention: ${concernText}`,
              reasoning
            );
            
            rest.push({
              id: `concern-${dbInsight.database_id}-${idCounter++}`,
              title: concernText,
              description: description,
              type: "negative",
              category: "Concern",
              timestamp: "Just now",
              impact: "High",
              source: dbInsight.database_name || "Unknown",
            });
          } catch (err) {
            console.error("Error processing area of concern:", err, concernItem);
          }
        });

        insights.key_metrics?.forEach((metric) => {
          try {
            const kpiName = String(metric?.kpi_name || 'Unknown KPI');
            const valueInterpretation = String(metric?.value_interpretation || '');
            const businessImpact = String(metric?.business_impact || '');
            const type = classifyKeyMetricType(metric);
            
            rest.push({
              id: `metric-${dbInsight.database_id}-${idCounter++}`,
              title: kpiName,
              description: businessImpact ? `${valueInterpretation} - ${businessImpact}` : valueInterpretation,
              type,
              category: "Key Metric",
              timestamp: "Just now",
              impact: "Medium",
              source: dbInsight.database_name || "Unknown",
            });
          } catch (err) {
            console.error("Error processing key metric:", err, metric);
          }
        });
      }
    });

    // Combine in the exact order: 1. Opportunities, 2. Insights_and_patterns, 3. Recommendations, 4. Rest
    const transformed: Insight[] = [];
    transformed.push(...opportunities);           // Position 1
    transformed.push(...insightsAndPatterns);   // Position 2
    transformed.push(...recommendations);       // Position 3
    transformed.push(...rest);                  // Position 4+ (strategic priorities, risks, concerns, metrics)

    return transformed;
    } catch (error) {
      console.error("Error in transformProjectInsights:", error, data);
      return []; // Return empty array on error to prevent crash
    }
  };

  const formatWithReasoning = (text: string, reasoning?: unknown) => {
    if (typeof reasoning !== "string") {
      return text;
    }
    const trimmed = reasoning.trim();
    if (!trimmed) {
      return text;
    }
    return `${text}\nReasoning: ${trimmed}`;
  };


  const transformBusinessInsights = (data: BusinessInsightsResponse): Insight[] => {
    try {
      const transformed: Insight[] = [];
      let idCounter = 1;

      const insights = data.insights;

    // Recommendations
    insights.recommendations?.forEach((rec) => {
      try {
        const title = String(rec?.title || 'Untitled Recommendation');
        const description = formatWithReasoning(
          String(rec?.description || ''),
          (rec as any)?.reasoning
        );
        transformed.push({
          id: `rec-${idCounter++}`,
          title: title,
          description: description,
          type: rec.priority === "high" ? "opportunity" : "positive",
          category: "Recommendation",
          timestamp: "Just now",
          impact: rec.priority === "high" ? "High" : rec.priority === "medium" ? "Medium" : "Low",
          source: data.database_name || "Unknown",
        });
      } catch (err) {
        console.error("Error processing recommendation:", err, rec);
      }
    });

    // Areas of concern
    insights.areas_of_concern?.forEach((concernItem) => {
      try {
        // Handle both object format { concern, reasoning } and string format
        const concernText = typeof concernItem === 'string' 
          ? concernItem 
          : (concernItem as any)?.concern || '';
        const reasoning = typeof concernItem === 'string' 
          ? '' 
          : (concernItem as any)?.reasoning || '';
        
        // Skip if no concern text
        if (!concernText || typeof concernText !== 'string') {
          return;
        }
        
        const description = formatWithReasoning(
          `Area requiring attention: ${concernText}`,
          reasoning
        );
        
        transformed.push({
          id: `concern-${idCounter++}`,
          title: concernText,
          description: description,
          type: "negative",
          category: "Concern",
          timestamp: "Just now",
          impact: "High",
          source: data.database_name || "Unknown",
        });
      } catch (err) {
        console.error("Error processing area of concern:", err, concernItem);
        // Skip this item and continue with others
      }
    });

    // Key metrics
    insights.key_metrics?.forEach((metric) => {
      try {
        const kpiName = String(metric?.kpi_name || 'Unknown KPI');
        const valueInterpretation = String(metric?.value_interpretation || '');
        const businessImpact = String(metric?.business_impact || '');
        const type = classifyKeyMetricType(metric);
        
        transformed.push({
          id: `metric-${idCounter++}`,
          title: kpiName,
          description: businessImpact ? `${valueInterpretation} - ${businessImpact}` : valueInterpretation,
          type,
          category: "Key Metric",
          timestamp: "Just now",
          impact: "Medium",
          source: data.database_name || "Unknown",
        });
      } catch (err) {
        console.error("Error processing key metric:", err, metric);
      }
    });

    // Insights and patterns
    insights.insights_and_patterns?.forEach((patternItem) => {
      try {
        // Handle both object format { insight, reasoning } and string format
        const insightText = typeof patternItem === 'string' 
          ? patternItem 
          : (patternItem as any)?.insight || '';
        const reasoning = typeof patternItem === 'string' 
          ? '' 
          : (patternItem as any)?.reasoning || '';
        
        // Skip if no insight text
        if (!insightText || typeof insightText !== 'string') {
          return;
        }
        
        const description = formatWithReasoning(insightText, reasoning);
        
        transformed.push({
          id: `pattern-${idCounter++}`,
          title: insightText.substring(0, 60) + (insightText.length > 60 ? "..." : ""),
          description: description,
          type: "opportunity",
          category: "Pattern",
          timestamp: "Just now",
          impact: "Medium",
          source: data.database_name || "Unknown",
        });
      } catch (err) {
        console.error("Error processing insight pattern:", err, patternItem);
        // Skip this item and continue with others
      }
    });

      return transformed;
    } catch (error) {
      console.error("Error in transformBusinessInsights:", error, data);
      return []; // Return empty array on error to prevent crash
    }
  };


  const handleGenerateInsights = async () => {
    if (!projectId) {
      toast.error("Project ID is required to generate insights");
      return;
    }

    setIsGenerating(true);
    setShowGenerateDialog(false);

    try {
      let response;
      
      if (selectedDatabase && selectedDatabase !== "all") {
        // Generate insights for a specific database
        response = await generateBusinessInsights(selectedDatabase);
        if (response.success && response.data) {
          try {
            const transformed = transformBusinessInsights(response.data);
            setInsights(transformed); // Replace old insights with new ones
            toast.success(`Generated ${transformed.length} insights from ${response.data.database_name}`);
          } catch (transformError: any) {
            console.error("Error transforming business insights:", transformError);
            toast.error("Failed to process insights data. Please try again.");
          }
        } else {
          const errorMessage = response.error?.message || "Failed to generate insights";
          toast.error(errorMessage);
        }
      } else {
        // Generate project-wide insights
        response = await generateProjectInsights(String(projectId));
        if (response.success && response.data) {
          try {
            const transformed = transformProjectInsights(response.data);
            setInsights(transformed); // Replace old insights with new ones
            toast.success(
              `Generated ${transformed.length} insights from ${response.data.successful_analyses} databases`
            );
          } catch (transformError: any) {
            console.error("Error transforming project insights:", transformError);
            toast.error("Failed to process insights data. Please try again.");
          }
        } else {
          const errorMessage = response.error?.message || "Failed to generate project insights";
          // Check if the error is about no database connections
          if (errorMessage.includes("No database connections found")) {
            toast.error("No database connections found for this project. Please add a database connection first.");
          } else {
            toast.error(errorMessage);
          }
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || "An error occurred while generating insights";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
      setSelectedDatabase("all");
    }
  };

  const handleExportCSV = () => {
    if (filteredInsights.length === 0) {
      toast.error("No insights to export");
      return;
    }

    // Convert insights to CSV format
    const headers = ["Title", "Description", "Type", "Category", "Impact", "Source", "Timestamp"];
    const csvRows = [
      headers.join(","),
      ...filteredInsights.map((insight) => {
        const escapeCell = (cell: any) => {
          if (cell === null || cell === undefined) return "";
          const cellString = String(cell);
          const needsEscaping = /[",\n\r]/.test(cellString);
          const escapedValue = cellString.replace(/"/g, '""');
          return needsEscaping ? `"${escapedValue}"` : escapedValue;
        };

        return [
          escapeCell(insight.title),
          escapeCell(insight.description),
          escapeCell(insight.type),
          escapeCell(insight.category),
          escapeCell(insight.impact),
          escapeCell(insight.source || ""),
          escapeCell(insight.timestamp),
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `insights-export-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Exported ${filteredInsights.length} insights to CSV`);
  };

  const handleCopyToClipboard = async (insight: Insight) => {
    const insightText = `${insight.title}\n\n${insight.description}\n\nType: ${insight.type}\nCategory: ${insight.category}\nImpact: ${insight.impact}\nSource: ${insight.source || "N/A"}\nTimestamp: ${insight.timestamp}`;
    
    try {
      await navigator.clipboard.writeText(insightText);
      setCopiedInsightId(insight.id);
      toast.success("Insight copied to clipboard");
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedInsightId(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toast.error("Failed to copy to clipboard");
    }
  };

  const handleAddToHome = async (insight: Insight) => {
    if (!projectId) {
      toast.error("Project ID is required to save insight");
      return;
    }

    try {
      const response = await saveHomeInsight({
        project_id: String(projectId),
        title: insight.title,
        description: insight.description,
        insight_type: insight.type,
        category: insight.category,
        impact: insight.impact,
        source: insight.source,
      });

      if (response.success) {
        toast.success("Insight added to home successfully!");
      } else {
        toast.error(response.error?.message || "Failed to add insight to home");
      }
    } catch (error) {
      console.error("Failed to add insight to home:", error);
      toast.error("Failed to add insight to home");
    }
  };

  // Calculate stats
  const totalInsights = insightStats.total;
  const positiveTrends = insightStats.positive;
  const requiresAttention = insightStats.negative;
  const anomalies = insightStats.anomalies;

  const [openInsightIds, setOpenInsightIds] = useState<Set<string | number>>(new Set());

  const typeStyles = {
    positive: {
      color: "text-success",
      bg: "bg-success/10",
    },
    negative: {
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    opportunity: {
      color: "text-accent",
      bg: "bg-accent/10",
    },
    default: {
      color: "text-muted-foreground",
      bg: "bg-muted/10",
    },
  } as const;

  const categoryIcons: Record<string, typeof Lightbulb> = {
    "Strategic Priority": Target,
    Opportunity: Sparkles,
    Risk: AlertTriangle,
    Concern: AlertOctagon,
    "Key Metric": BarChart3,
    Pattern: LineChart,
    Recommendation: CheckCircle2,
  };

  return (
    <div className="min-h-full">
      <div className="ws-page">
        {/* Header */}
        <header className="ws-header">
          <div>
            <h1 className="ws-title">AI Insights</h1>
            <p className="ws-subtitle">Trends, risks and anomalies VizAI found in your data.</p>
          </div>
          <div className="ws-actions">
            {/* <Button 
              variant="outline"
              onClick={() => setShowGenerateDialog(true)}
              disabled={!projectId || isGenerating}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button> */}
            <Button 
              variant="outline"
              className="ws-primary-btn"
              onClick={handleExportCSV}
              disabled={filteredInsights.length === 0 || isGenerating}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button 
              className="ws-primary-btn bg-gradient-to-r from-primary to-accent text-white"
              onClick={() => setShowGenerateDialog(true)}
              disabled={!projectId || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Insights
                </>
              )}
            </Button>
          </div>
        </header>

        {/* Stats tiles (click to filter) */}
        <div className="ins-stats">
          {[
            { id: "all", label: "Total insights", value: totalInsights, Icon: Lightbulb, tone: "ink", enabled: true },
            { id: "positive", label: "Positive trends", value: positiveTrends, Icon: TrendingUp, tone: "green", enabled: insightStats.positive > 0 },
            { id: "negative", label: "Needs attention", value: requiresAttention, Icon: TrendingDown, tone: "red", enabled: insightStats.negative > 0 },
            { id: "anomalies", label: "Anomalies", value: anomalies, Icon: AlertCircle, tone: "orange", enabled: insightStats.anomalies > 0 },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={`ins-stat ins-tone-${t.tone}${activeFilter === t.id ? " is-active" : ""}`}
              onClick={() => t.enabled && setActiveFilter(t.id)}
              disabled={!t.enabled}
              aria-pressed={activeFilter === t.id}
            >
              <span className="ins-stat-icon"><t.Icon className="w-[18px] h-[18px]" aria-hidden="true" /></span>
              <span className="ins-stat-value">{t.value}</span>
              <span className="ins-stat-label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={setActiveFilter}>
          <TabsList>
            {filterOptions.map((option) => (
              <TabsTrigger key={option.value} value={option.value}>
                {option.count !== undefined
                  ? `${option.label} (${option.count})`
                  : option.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Insights Grid */}
        {filteredInsights.length === 0 ? (
          <div className="ws-empty">
            <span className="ws-empty-icon">
              <Lightbulb className="w-7 h-7" aria-hidden="true" />
            </span>
            <p className="ws-empty-title">No insights yet</p>
            <p className="ws-empty-text">
              {projectId 
                ? "Generate insights to discover patterns in your data" 
                : "Select a project to generate insights"}
            </p>
            {projectId && (
              <Button 
                className="ws-primary-btn bg-gradient-to-r from-primary to-accent text-white"
                onClick={() => setShowGenerateDialog(true)}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Insights
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="ins-grid">
            {filteredInsights.map((insight) => {
              const Icon =
                categoryIcons[insight.category] ??
                (insight.type === "positive"
                  ? TrendingUp
                  : insight.type === "negative"
                  ? TrendingDown
                  : Lightbulb);

              const primaryLabel = "\nReasoning:";
              let reasoningIndex = insight.description.indexOf(primaryLabel);
              let reasoningLabel = primaryLabel;
              if (reasoningIndex === -1) {
                reasoningLabel = "Reasoning:";
                reasoningIndex = insight.description.indexOf(reasoningLabel);
              }
              const hasReasoning = reasoningIndex !== -1;
              const mainDescription = (hasReasoning
                ? insight.description.slice(0, reasoningIndex).trimEnd()
                : insight.description
              )
                // The impact pill already says this
                .replace(/\s*-?\s*Potential Impact:\s*\w+\.?\s*$/i, "")
                .trim();
              const reasoningText = hasReasoning
                ? insight.description.slice(reasoningIndex + reasoningLabel.length).trim()
                : "";
              const isOpen = openInsightIds.has(insight.id);
              const typeLabel =
                insight.type === "positive" ? "Positive" : insight.type === "negative" ? "Risk" : insight.type === "opportunity" ? "Opportunity" : (insight.category || "Insight");
              const impact = String(insight.impact || "").toLowerCase();

              return (
                <article key={insight.id} className={`ins-card ins-type-${insight.type ?? "default"}`}>
                  <div className="ins-card-top">
                    <span className="ins-chip">
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                      {typeLabel}
                    </span>
                    {insight.impact && (
                      <span className={`ins-impact is-${impact}`}>{insight.impact} impact</span>
                    )}
                    <div className="ins-card-actions">
                      <button
                        type="button"
                        className="ins-icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyToClipboard(insight);
                        }}
                        aria-label="Copy insight"
                        title="Copy"
                        disabled={isGenerating}
                      >
                        {copiedInsightId === insight.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        className="ins-save-btn"
                        onClick={() => handleAddToHome(insight)}
                        disabled={isGenerating}
                        title="Save to Overview"
                      >
                        <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                        Save
                      </button>
                    </div>
                  </div>

                  <h3 className="ins-card-title">{insight.title}</h3>
                  <p className={`ins-card-text${isOpen ? "" : " is-clamped"}`}>{mainDescription}</p>

                  {hasReasoning && (
                    <>
                      <button
                        type="button"
                        className="ins-why"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setOpenInsightIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(insight.id)) next.delete(insight.id);
                            else next.add(insight.id);
                            return next;
                          })
                        }
                      >
                        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                        {isOpen ? "Hide reasoning" : "Why VizAI thinks this"}
                      </button>
                      {isOpen && <blockquote className="ins-reason">{reasoningText}</blockquote>}
                    </>
                  )}

                  <div className="ins-card-foot">
                    {insight.source && (
                      <span className="ins-meta">
                        <Database className="w-3.5 h-3.5" aria-hidden="true" />
                        {insight.source}
                      </span>
                    )}
                    {insight.category && insight.category !== typeLabel && (
                      <span className="ins-meta">{insight.category}</span>
                    )}
                    <span className="ins-meta ins-meta--time">{insight.timestamp}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Generate Insights Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Insights</DialogTitle>
              <DialogDescription>
                Choose to generate insights for a specific database or all databases in the project.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Database</label>
                <Select value={selectedDatabase} onValueChange={setSelectedDatabase}>
                  <SelectTrigger>
                    <SelectValue placeholder="All databases (Project-wide)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All databases (Project-wide)</SelectItem>
                    {databases.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No databases available
                      </SelectItem>
                    ) : (
                      databases.map((db) => (
                        <SelectItem key={db.id} value={db.id}>
                          {db.name} ({db.type})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedDatabase === "all"
                    ? "Project-wide insights analyze all databases and provide consolidated strategic insights."
                    : selectedDatabase && databases.find(db => db.id === selectedDatabase)
                    ? `Database-specific insights provide focused analysis for ${databases.find(db => db.id === selectedDatabase)?.name}.`
                    : "Select a database or choose project-wide analysis."}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateInsights}
                  disabled={isGenerating || (selectedDatabase !== "all" && !databases.find(db => db.id === selectedDatabase))}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
