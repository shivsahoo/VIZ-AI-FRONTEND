import { useState, useEffect, useCallback } from "react";
import { Lightbulb, TrendingUp, TrendingDown, AlertCircle, Filter, Sparkles, Loader2, Database } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "../components/ui/tabs";
import { 
  generateProjectInsights, 
  generateBusinessInsights,
  getDatabases,
  type ProjectInsightsResponse,
  type BusinessInsightsResponse,
  type Database as ApiDatabase,
} from "../services/api";
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

export function InsightsView({ projectId }: InsightsViewProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [databases, setDatabases] = useState<ApiDatabase[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>("all");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filteredInsights, setFilteredInsights] = useState<Insight[]>([]);


  // Filter insights based on active tab
  useEffect(() => {
    let filtered = insights;
    
    switch (activeTab) {
      case "recent":
        // Show most recent insights (first 10)
        filtered = insights.slice(0, 10);
        break;
      case "trending":
        // Show positive insights (trending)
        filtered = insights.filter(i => i.type === "positive");
        break;
      case "anomalies":
        // Show negative insights (anomalies/concerns)
        filtered = insights.filter(i => i.type === "negative");
        break;
      default:
        filtered = insights;
    }
    
    setFilteredInsights(filtered);
  }, [activeTab, insights]);

  const fetchDatabases = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const response = await getDatabases(String(projectId));
      if (response.success && response.data) {
        // Backend returns all databases for the project
        setDatabases(response.data);
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
    if (projectId) {
      fetchDatabases();
    }
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

  const transformProjectInsights = (data: ProjectInsightsResponse): Insight[] => {
    const transformed: Insight[] = [];
    let idCounter = 1;

    // Transform consolidated insights (project-wide)
    if (data.consolidated_insights) {
      const consolidated = data.consolidated_insights;
      
      // Strategic priorities as opportunities
      consolidated.strategic_priorities?.forEach((priority) => {
        transformed.push({
          id: `priority-${idCounter++}`,
          title: priority.title,
          description: priority.description,
          type: "opportunity",
          category: "Strategic Priority",
          timestamp: "Just now",
          impact: priority.impact === "high" ? "High" : priority.impact === "medium" ? "Medium" : "Low",
          source: "Project-wide",
        });
      });

      // Opportunities
      consolidated.opportunities?.forEach((opportunity) => {
        transformed.push({
          id: `opportunity-${idCounter++}`,
          title: opportunity.title,
          description: `${opportunity.description} - Potential Impact: ${opportunity.potential_impact}`,
          type: "opportunity",
          category: "Opportunity",
          timestamp: "Just now",
          impact: "Medium",
          source: "Project-wide",
        });
      });

      // Critical risks as negative insights
      consolidated.risk_assessment?.critical_risks?.forEach((risk) => {
        transformed.push({
          id: `risk-critical-${idCounter++}`,
          title: risk,
          description: `Critical risk identified: ${risk}`,
          type: "negative",
          category: "Risk",
          timestamp: "Just now",
          impact: "High",
          source: "Project-wide",
        });
      });

      // Moderate risks
      consolidated.risk_assessment?.moderate_risks?.forEach((risk) => {
        transformed.push({
          id: `risk-moderate-${idCounter++}`,
          title: risk,
          description: `Moderate risk identified: ${risk}`,
          type: "negative",
          category: "Risk",
          timestamp: "Just now",
          impact: "Medium",
          source: "Project-wide",
        });
      });
    }

    // Transform database-specific insights
    data.database_insights?.forEach((dbInsight) => {
      if (dbInsight.insights) {
        const insights = dbInsight.insights;
        
        // Recommendations
        insights.recommendations?.forEach((rec) => {
          transformed.push({
            id: `rec-${dbInsight.database_id}-${idCounter++}`,
            title: rec.title,
            description: rec.description,
            type: rec.priority === "high" ? "opportunity" : "positive",
            category: "Recommendation",
            timestamp: "Just now",
            impact: rec.priority === "high" ? "High" : rec.priority === "medium" ? "Medium" : "Low",
            source: dbInsight.database_name,
          });
        });

        // Areas of concern as negative insights
        insights.areas_of_concern?.forEach((concern) => {
          transformed.push({
            id: `concern-${dbInsight.database_id}-${idCounter++}`,
            title: concern,
            description: `Area requiring attention: ${concern}`,
            type: "negative",
            category: "Concern",
            timestamp: "Just now",
            impact: "High",
            source: dbInsight.database_name,
          });
        });

        // Key metrics as positive/negative based on interpretation
        insights.key_metrics?.forEach((metric) => {
          const isPositive = metric.value_interpretation?.toLowerCase().includes("good") ||
                           metric.value_interpretation?.toLowerCase().includes("excellent") ||
                           metric.value_interpretation?.toLowerCase().includes("improving");
          
          transformed.push({
            id: `metric-${dbInsight.database_id}-${idCounter++}`,
            title: metric.kpi_name,
            description: `${metric.value_interpretation} - ${metric.business_impact}`,
            type: isPositive ? "positive" : "negative",
            category: "Key Metric",
            timestamp: "Just now",
            impact: "Medium",
            source: dbInsight.database_name,
          });
        });

        // Insights and patterns
        insights.insights_and_patterns?.forEach((pattern) => {
          transformed.push({
            id: `pattern-${dbInsight.database_id}-${idCounter++}`,
            title: pattern.substring(0, 60) + (pattern.length > 60 ? "..." : ""),
            description: pattern,
            type: "opportunity",
            category: "Pattern",
            timestamp: "Just now",
            impact: "Medium",
            source: dbInsight.database_name,
          });
        });
      }
    });

    return transformed;
  };

  const transformBusinessInsights = (data: BusinessInsightsResponse): Insight[] => {
    const transformed: Insight[] = [];
    let idCounter = 1;

    const insights = data.insights;

    // Recommendations
    insights.recommendations?.forEach((rec) => {
      transformed.push({
        id: `rec-${idCounter++}`,
        title: rec.title,
        description: rec.description,
        type: rec.priority === "high" ? "opportunity" : "positive",
        category: "Recommendation",
        timestamp: "Just now",
        impact: rec.priority === "high" ? "High" : rec.priority === "medium" ? "Medium" : "Low",
        source: data.database_name,
      });
    });

    // Areas of concern
    insights.areas_of_concern?.forEach((concern) => {
      transformed.push({
        id: `concern-${idCounter++}`,
        title: concern,
        description: `Area requiring attention: ${concern}`,
        type: "negative",
        category: "Concern",
        timestamp: "Just now",
        impact: "High",
        source: data.database_name,
      });
    });

    // Key metrics
    insights.key_metrics?.forEach((metric) => {
      const isPositive = metric.value_interpretation?.toLowerCase().includes("good") ||
                       metric.value_interpretation?.toLowerCase().includes("excellent") ||
                       metric.value_interpretation?.toLowerCase().includes("improving");
      
      transformed.push({
        id: `metric-${idCounter++}`,
        title: metric.kpi_name,
        description: `${metric.value_interpretation} - ${metric.business_impact}`,
        type: isPositive ? "positive" : "negative",
        category: "Key Metric",
        timestamp: "Just now",
        impact: "Medium",
        source: data.database_name,
      });
    });

    // Insights and patterns
    insights.insights_and_patterns?.forEach((pattern) => {
      transformed.push({
        id: `pattern-${idCounter++}`,
        title: pattern.substring(0, 60) + (pattern.length > 60 ? "..." : ""),
        description: pattern,
        type: "opportunity",
        category: "Pattern",
        timestamp: "Just now",
        impact: "Medium",
        source: data.database_name,
      });
    });

    return transformed;
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
          const transformed = transformBusinessInsights(response.data);
          setInsights(prev => [...transformed, ...prev]);
          toast.success(`Generated ${transformed.length} insights from ${response.data.database_name}`);
        } else {
          toast.error(response.error?.message || "Failed to generate insights");
        }
      } else {
        // Generate project-wide insights
        response = await generateProjectInsights(String(projectId));
        if (response.success && response.data) {
          const transformed = transformProjectInsights(response.data);
          setInsights(prev => [...transformed, ...prev]);
          toast.success(
            `Generated ${transformed.length} insights from ${response.data.successful_analyses} databases`
          );
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

  // Calculate stats
  const totalInsights = insights.length;
  const positiveTrends = insights.filter(i => i.type === "positive").length;
  const requiresAttention = insights.filter(i => i.type === "negative").length;
  const anomalies = insights.filter(i => i.type === "negative" && i.impact === "High").length;

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
            <Button 
              variant="outline"
              onClick={() => setShowGenerateDialog(true)}
              disabled={!projectId || isGenerating}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
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
          <Card className="p-6 border border-border">
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

          <Card className="p-6 border border-border">
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

          <Card className="p-6 border border-border">
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

          <Card className="p-6 border border-border">
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All Insights</TabsTrigger>
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
            <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
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
              const iconColor = 
                insight.type === 'positive' ? 'text-success' :
                insight.type === 'negative' ? 'text-destructive' :
                'text-accent';
              
              const iconBg = 
                insight.type === 'positive' ? 'bg-success/10' :
                insight.type === 'negative' ? 'bg-destructive/10' :
                'bg-accent/10';

              const Icon = 
                insight.type === 'positive' ? TrendingUp :
                insight.type === 'negative' ? TrendingDown :
                Lightbulb;

              return (
                <Card 
                  key={insight.id}
                  className="p-6 border border-border hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex gap-4">
                    <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-6 h-6 ${iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg text-foreground mb-2">{insight.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {insight.description}
                          </p>
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
