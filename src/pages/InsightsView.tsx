import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Lightbulb, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  AlertTriangle,
  AlertOctagon,
  BarChart3,
  CheckCircle2,
  Filter, 
  LineChart,
  Loader2, 
  Sparkles, 
  Target,
  Database,
  Download,
  Copy,
  Check
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  generateProjectInsights, 
  generateBusinessInsights,
  getLatestBusinessInsight,
  getDatabases,
  type ProjectInsightsResponse,
  type BusinessInsightsResponse,
  type LatestBusinessInsightResponse,
  type BusinessInsightRecord,
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

export function InsightsView({ projectId }: InsightsViewProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Load existing insights when component mounts
  const loadExistingInsights = useCallback(async () => {
    if (!projectId) return;

    setIsLoading(true);
    try {
      const response = await getLatestBusinessInsight(String(projectId));
      if (response.success && response.data) {
        const transformed = transformBusinessInsightRecord(response.data.insight);
        if (transformed.length > 0) {
          setInsights(transformed);
        }
      } else if (response.error) {
        // It's okay if there are no existing insights - don't show error
        if (!response.error.message?.includes("No business insights found")) {
          console.log("No existing insights found for this project");
        }
      }
    } catch (error) {
      // Silently fail - it's okay if there are no existing insights
      console.log("Could not load existing insights:", error);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Load existing insights on mount
  useEffect(() => {
    loadExistingInsights();
  }, [loadExistingInsights]);

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

  const transformProjectInsights = (data: ProjectInsightsResponse): Insight[] => {
    try {
      const transformed: Insight[] = [];
      let idCounter = 1;

    // Transform consolidated insights (project-wide)
    if (data.consolidated_insights) {
      const consolidated = data.consolidated_insights;
      
      // Strategic priorities as opportunities
      consolidated.strategic_priorities?.forEach((priority) => {
        try {
          const title = String(priority?.title || 'Untitled Priority');
          const description = formatWithReasoning(
            String(priority?.description || ''),
            (priority as any)?.reasoning
          );
          transformed.push({
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

      // Opportunities
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
          transformed.push({
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

      // Critical risks as negative insights
      consolidated.risk_assessment?.critical_risks?.forEach((riskItem) => {
        try {
          // Handle both object format { risk, reasoning } and string format
          const riskText = typeof riskItem === 'string' 
            ? riskItem 
            : (riskItem as any)?.risk || '';
          const reasoning = typeof riskItem === 'string' 
            ? '' 
            : (riskItem as any)?.reasoning || '';
          
          // Skip if no risk text
          if (!riskText || typeof riskText !== 'string') {
            return;
          }
          
          const description = formatWithReasoning(
            `Critical risk identified: ${riskText}`,
            reasoning
          );
          
          transformed.push({
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
          // Skip this item and continue with others
        }
      });

      // Moderate risks
      consolidated.risk_assessment?.moderate_risks?.forEach((riskItem) => {
        try {
          // Handle both object format { risk, reasoning } and string format
          const riskText = typeof riskItem === 'string' 
            ? riskItem 
            : (riskItem as any)?.risk || '';
          const reasoning = typeof riskItem === 'string' 
            ? '' 
            : (riskItem as any)?.reasoning || '';
          
          // Skip if no risk text
          if (!riskText || typeof riskText !== 'string') {
            return;
          }
          
          const description = formatWithReasoning(
            `Moderate risk identified: ${riskText}`,
            reasoning
          );
          
          transformed.push({
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
          // Skip this item and continue with others
        }
      });

      // Cross-database patterns
      consolidated.cross_database_patterns?.forEach((patternItem) => {
        try {
          // Handle both object format { pattern, reasoning } and string format
          const patternText = typeof patternItem === 'string' 
            ? patternItem 
            : (patternItem as any)?.pattern || '';
          const reasoning = typeof patternItem === 'string' 
            ? '' 
            : (patternItem as any)?.reasoning || '';
          
          // Skip if no pattern text
          if (!patternText || typeof patternText !== 'string') {
            return;
          }
          
          const description = formatWithReasoning(patternText, reasoning);
          
          transformed.push({
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
          // Skip this item and continue with others
        }
      });
    }

    // Transform database-specific insights
    data.database_insights?.forEach((dbInsight) => {
      if (dbInsight.insights) {
        const insights = dbInsight.insights;
        
        // Recommendations
        insights.recommendations?.forEach((rec) => {
          try {
            const title = String(rec?.title || 'Untitled Recommendation');
            const description = formatWithReasoning(
              String(rec?.description || ''),
              (rec as any)?.reasoning
            );
            transformed.push({
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

        // Areas of concern as negative insights
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
            // Skip this item and continue with others
          }
        });

        // Key metrics as positive/negative based on interpretation
        insights.key_metrics?.forEach((metric) => {
          try {
            const kpiName = String(metric?.kpi_name || 'Unknown KPI');
            const valueInterpretation = String(metric?.value_interpretation || '');
            const businessImpact = String(metric?.business_impact || '');
            const isPositive = valueInterpretation.toLowerCase().includes("good") ||
                             valueInterpretation.toLowerCase().includes("excellent") ||
                             valueInterpretation.toLowerCase().includes("improving");
            
            transformed.push({
              id: `metric-${dbInsight.database_id}-${idCounter++}`,
              title: kpiName,
              description: businessImpact ? `${valueInterpretation} - ${businessImpact}` : valueInterpretation,
              type: isPositive ? "positive" : "negative",
              category: "Key Metric",
              timestamp: "Just now",
              impact: "Medium",
              source: dbInsight.database_name || "Unknown",
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
            // Skip this item and continue with others
          }
        });
      }
    });

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

  const transformBusinessInsightRecord = (record: BusinessInsightRecord): Insight[] => {
    try {
      const transformed: Insight[] = [];
      let idCounter = 1;

      // Helper to format timestamp
      const formatTimestamp = (dateString: string) => {
        try {
          const date = new Date(dateString);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffMins = Math.floor(diffMs / 60000);
          const diffHours = Math.floor(diffMs / 3600000);
          const diffDays = Math.floor(diffMs / 86400000);

          if (diffMins < 1) return "Just now";
          if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
          if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
          if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
          return date.toLocaleDateString();
        } catch {
          return "Recently";
        }
      };

      const timestamp = formatTimestamp(record.created_at);

      // Transform key_metrics - can be object or array
      if (record.key_metrics) {
        if (Array.isArray(record.key_metrics)) {
          // Handle array format (from fresh generation)
          record.key_metrics.forEach((metric: any) => {
            try {
              const kpiName = String(metric?.kpi_name || 'Unknown KPI');
              const valueInterpretation = String(metric?.value_interpretation || '');
              const businessImpact = String(metric?.business_impact || '');
              const isPositive = valueInterpretation.toLowerCase().includes("good") ||
                               valueInterpretation.toLowerCase().includes("excellent") ||
                               valueInterpretation.toLowerCase().includes("improving");
              
              transformed.push({
                id: `record-metric-${record.id}-${idCounter++}`,
                title: kpiName,
                description: businessImpact ? `${valueInterpretation} - ${businessImpact}` : valueInterpretation,
                type: isPositive ? "positive" : "negative",
                category: "Key Metric",
                timestamp: timestamp,
                impact: "Medium",
                source: "Project-wide",
              });
            } catch (err) {
              console.error("Error processing key metric from record:", err, metric);
            }
          });
        } else if (typeof record.key_metrics === 'object') {
          // Handle object format (from stored insights) - show as summary
          const metrics = record.key_metrics as any;
          if (metrics.overall_health_score) {
            const healthScore = String(metrics.overall_health_score || 'unknown');
            const totalDbs = metrics.total_databases_analyzed || 0;
            const successful = metrics.successful_analyses || 0;
            const isPositive = healthScore.toLowerCase() === "excellent" || healthScore.toLowerCase() === "good";
            
            transformed.push({
              id: `record-metric-summary-${record.id}-${idCounter++}`,
              title: `Overall Health: ${healthScore.charAt(0).toUpperCase() + healthScore.slice(1)}`,
              description: `Analyzed ${totalDbs} database(s) with ${successful} successful analysis(es)`,
              type: isPositive ? "positive" : "negative",
              category: "Key Metric",
              timestamp: timestamp,
              impact: "High",
              source: "Project-wide",
            });
          }
        }
      }

      // Transform insights_and_patterns - check for both 'pattern' and 'insight' fields
      if (record.insights_and_patterns && Array.isArray(record.insights_and_patterns)) {
        record.insights_and_patterns.forEach((patternItem: any) => {
          try {
            // Handle both 'pattern' (from stored) and 'insight' (from fresh) field names
            const patternText = typeof patternItem === 'string' 
              ? patternItem 
              : (patternItem as any)?.pattern || (patternItem as any)?.insight || '';
            const reasoning = typeof patternItem === 'string' 
              ? '' 
              : (patternItem as any)?.reasoning || '';
            
            if (!patternText || typeof patternText !== 'string') {
              return;
            }
            
            const description = formatWithReasoning(patternText, reasoning);
            
            transformed.push({
              id: `record-pattern-${record.id}-${idCounter++}`,
              title: patternText.substring(0, 60) + (patternText.length > 60 ? "..." : ""),
              description: description,
              type: "opportunity",
              category: "Pattern",
              timestamp: timestamp,
              impact: "Medium",
              source: "Project-wide",
            });
          } catch (err) {
            console.error("Error processing insight pattern from record:", err, patternItem);
          }
        });
      }

      // Transform recommendations - check for both 'priority' and 'impact' fields
      if (record.recommendations && Array.isArray(record.recommendations)) {
        record.recommendations.forEach((rec: any) => {
          try {
            const title = String(rec?.title || 'Untitled Recommendation');
            const description = formatWithReasoning(
              String(rec?.description || ''),
              rec?.reasoning
            );
            // Handle both 'priority' (from fresh) and 'impact' (from stored) field names
            const priority = rec.priority || rec.impact || 'medium';
            const impactLevel = priority === "high" ? "High" : priority === "medium" ? "Medium" : "Low";
            transformed.push({
              id: `record-rec-${record.id}-${idCounter++}`,
              title: title,
              description: description,
              type: priority === "high" ? "opportunity" : "positive",
              category: "Recommendation",
              timestamp: timestamp,
              impact: impactLevel,
              source: "Project-wide",
            });
          } catch (err) {
            console.error("Error processing recommendation from record:", err, rec);
          }
        });
      }

      // Transform areas_of_concern - can be array or object with critical_risks/moderate_risks
      if (record.areas_of_concern) {
        if (Array.isArray(record.areas_of_concern)) {
          // Handle array format (from fresh generation)
          record.areas_of_concern.forEach((concernItem: any) => {
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
              
              transformed.push({
                id: `record-concern-${record.id}-${idCounter++}`,
                title: concernText,
                description: description,
                type: "negative",
                category: "Concern",
                timestamp: timestamp,
                impact: "High",
                source: "Project-wide",
              });
            } catch (err) {
              console.error("Error processing area of concern from record:", err, concernItem);
            }
          });
        } else if (typeof record.areas_of_concern === 'object') {
          // Handle object format with critical_risks and moderate_risks (from stored insights)
          const concerns = record.areas_of_concern as any;
          
          // Process critical risks
          if (concerns.critical_risks && Array.isArray(concerns.critical_risks)) {
            concerns.critical_risks.forEach((riskItem: any) => {
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
                  `Critical risk: ${riskText}`,
                  reasoning
                );
                
                transformed.push({
                  id: `record-risk-critical-${record.id}-${idCounter++}`,
                  title: riskText,
                  description: description,
                  type: "negative",
                  category: "Risk",
                  timestamp: timestamp,
                  impact: "High",
                  source: "Project-wide",
                });
              } catch (err) {
                console.error("Error processing critical risk from record:", err, riskItem);
              }
            });
          }
          
          // Process moderate risks
          if (concerns.moderate_risks && Array.isArray(concerns.moderate_risks)) {
            concerns.moderate_risks.forEach((riskItem: any) => {
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
                  `Moderate risk: ${riskText}`,
                  reasoning
                );
                
                transformed.push({
                  id: `record-risk-moderate-${record.id}-${idCounter++}`,
                  title: riskText,
                  description: description,
                  type: "negative",
                  category: "Risk",
                  timestamp: timestamp,
                  impact: "Medium",
                  source: "Project-wide",
                });
              } catch (err) {
                console.error("Error processing moderate risk from record:", err, riskItem);
              }
            });
          }
        }
      }

      return transformed;
    } catch (error) {
      console.error("Error in transformBusinessInsightRecord:", error, record);
      return [];
    }
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
        const isPositive = valueInterpretation.toLowerCase().includes("good") ||
                         valueInterpretation.toLowerCase().includes("excellent") ||
                         valueInterpretation.toLowerCase().includes("improving");
        
        transformed.push({
          id: `metric-${idCounter++}`,
          title: kpiName,
          description: businessImpact ? `${valueInterpretation} - ${businessImpact}` : valueInterpretation,
          type: isPositive ? "positive" : "negative",
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
            setInsights(prev => [...transformed, ...prev]);
            toast.success(`Generated ${transformed.length} insights from ${response.data.database_name}`);
          } catch (transformError: any) {
            console.error("Error transforming business insights:", transformError);
            toast.error("Failed to process insights data. Please try again.");
          }
        } else {
          toast.error(response.error?.message || "Failed to generate insights");
        }
      } else {
        // Generate project-wide insights
        response = await generateProjectInsights(String(projectId));
        if (response.success && response.data) {
          try {
            const transformed = transformProjectInsights(response.data);
            setInsights(prev => [...transformed, ...prev]);
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
      toast.error(error.message || "An error occurred while generating insights");
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

  // Calculate stats
  const totalInsights = insightStats.total;
  const positiveTrends = insightStats.positive;
  const requiresAttention = insightStats.negative;
  const anomalies = insightStats.anomalies;

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
    <div className="px-12 py-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl text-foreground mb-1">AI Insights</h2>
            <p className="text-muted-foreground">Automatic discoveries and anomalies detected in your data</p>
          </div>
          <div className="flex gap-3">
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
              onClick={handleExportCSV}
              disabled={filteredInsights.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export Insights
            </Button>
            <Button 
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
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
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card 
            className="p-6 border border-border cursor-pointer hover:shadow-lg transition-all hover:border-accent"
            onClick={() => setActiveFilter("all")}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">{totalInsights}</p>
                <p className="text-sm text-muted-foreground">Total Insights</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 border border-border cursor-pointer hover:shadow-lg transition-all hover:border-success"
            onClick={() => {
              if (insightStats.positive > 0) {
                setActiveFilter("positive");
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">{positiveTrends}</p>
                <p className="text-sm text-muted-foreground">Positive Trends</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 border border-border cursor-pointer hover:shadow-lg transition-all hover:border-destructive"
            onClick={() => {
              if (insightStats.negative > 0) {
                setActiveFilter("negative");
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">{requiresAttention}</p>
                <p className="text-sm text-muted-foreground">Requires Attention</p>
              </div>
            </div>
          </Card>

          <Card 
            className="p-6 border border-border cursor-pointer hover:shadow-lg transition-all hover:border-chart-2"
            onClick={() => {
              if (insightStats.anomalies > 0) {
                setActiveFilter("anomalies");
              }
            }}
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-chart-2/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-chart-2" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">{anomalies}</p>
                <p className="text-sm text-muted-foreground">Anomalies Detected</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={setActiveFilter} className="mb-6">
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
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg text-foreground mb-2">No insights yet</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {projectId 
                ? "Generate insights to discover patterns in your data" 
                : "Select a project to generate insights"}
            </p>
            {projectId && (
              <Button 
                className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                onClick={() => setShowGenerateDialog(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Insights
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInsights.map((insight) => {
              const style = typeStyles[insight.type as keyof typeof typeStyles] ?? typeStyles.default;
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
              const mainDescription = hasReasoning
                ? insight.description.slice(0, reasoningIndex).trimEnd()
                : insight.description;
              const reasoningText = hasReasoning
                ? insight.description.slice(reasoningIndex + reasoningLabel.length).trim()
                : "";

              return (
                <Card 
                  key={insight.id}
                  className="p-6 border border-border hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${style.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg text-foreground mb-2">{insight.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                            {mainDescription}
                          </p>
                          {hasReasoning && (
                            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                              <span className="font-semibold">Reasoning:</span> {reasoningText}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToClipboard(insight);
                            }}
                            title="Copy to clipboard"
                          >
                            {copiedInsightId === insight.id ? (
                              <Check className="w-4 h-4 text-success" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="whitespace-nowrap"
                            onClick={() => toast.info("Adding insights to dashboards coming soon.")}
                          >
                            + Add to Dashboard
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-sm">
                        <Badge variant="outline" className="border-border">
                          {insight.category}
                        </Badge>
                        {insight.source && (
                          <Badge variant="outline" className="border-border">
                            <Database className="w-3 h-3 mr-1" />
                            {insight.source}
                          </Badge>
                        )}
                        <Badge 
                          className={
                            insight.impact === 'High' 
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : insight.impact === 'Medium'
                              ? 'bg-chart-2/10 text-chart-2 border-chart-2/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }
                        >
                          {insight.impact} Impact
                        </Badge>
                        <span className="text-muted-foreground">{insight.timestamp}</span>
                      </div>
                    </div>
                  </div>
                </Card>
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
