import { useState, useEffect, useCallback } from "react";
import type { MouseEvent } from "react";
import { Pin, TrendingUp, TrendingDown, BarChart3, Lightbulb, Plus, ArrowRight, Clock, Star, LayoutDashboard } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { GradientButton } from "../components/shared/GradientButton";
import { ChartPreviewDialog } from "../components/features/charts/ChartPreviewDialog";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, ResponsiveContainer, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { toast } from "sonner";
import { PinnedChartData } from "../context/PinnedChartsContext";
import { getFavoriteCharts, updateFavoriteChart, getFavorites } from "../services/api";

interface HomeDashboardViewProps {
  onNavigate?: (tab: string) => void;
  onOpenAIAssistant?: () => void;
}

const recentInsights = [
  {
    id: 1,
    title: "Revenue Spike Detected",
    description: "Revenue increased by 34% in the last week, driven primarily by enterprise customers.",
    type: "positive",
    category: "Revenue",
    timestamp: "2 hours ago",
    impact: "High"
  },
  {
    id: 2,
    title: "Customer Churn Rate Increasing",
    description: "Monthly churn rate has risen to 5.2%, up from the average of 3.8%.",
    type: "negative",
    category: "Retention",
    timestamp: "5 hours ago",
    impact: "High"
  },
  {
    id: 3,
    title: "New Market Opportunity",
    description: "Analysis shows 23% of traffic comes from Southeast Asia, but only 8% convert.",
    type: "opportunity",
    category: "Growth",
    timestamp: "1 day ago",
    impact: "Medium"
  }
];

const chartTypeIcons = {
  line: TrendingUp,
  bar: BarChart3,
  pie: BarChart3,
  area: TrendingUp
};

const chartTypeColors = {
  line: 'text-[#06B6D4] bg-[#06B6D4]/10',
  bar: 'text-[#8B5CF6] bg-[#8B5CF6]/10',
  pie: 'text-[#10B981] bg-[#10B981]/10',
  area: 'text-[#F59E0B] bg-[#F59E0B]/10'
};

// Sample data for chart visualizations
const lineChartData = [
  { month: "Jan", value: 4200 },
  { month: "Feb", value: 5100 },
  { month: "Mar", value: 4800 },
  { month: "Apr", value: 6300 },
  { month: "May", value: 7200 },
  { month: "Jun", value: 8100 }
];

const barChartData = [
  { name: "A", value: 4500 },
  { name: "B", value: 7200 },
  { name: "C", value: 5800 },
  { name: "D", value: 6100 }
];

const pieChartData = [
  { name: "Enterprise", value: 45 },
  { name: "SMB", value: 30 },
  { name: "Startup", value: 25 }
];

const areaChartData = [
  { month: "Jan", users: 1200 },
  { month: "Feb", users: 1900 },
  { month: "Mar", users: 2400 },
  { month: "Apr", users: 3100 },
  { month: "May", users: 3800 },
  { month: "Jun", users: 4500 }
];

const PIE_COLORS = ["#06B6D4", "#5B67F1", "#8B5CF6"];

// Extended interface to store original API chart ID
interface FavoriteChartData extends PinnedChartData {
  originalId: string; // Store the original UUID from API
}

interface FavoriteDashboard {
  id: string;
  name: string;
  description: string;
  user_id: string;
}

export function HomeDashboardView({ onNavigate }: HomeDashboardViewProps) {
  const [favoriteCharts, setFavoriteCharts] = useState<FavoriteChartData[]>([]);
  const [favoriteDashboards, setFavoriteDashboards] = useState<FavoriteDashboard[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [selectedChart, setSelectedChart] = useState<PinnedChartData | null>(null);
  const [pinnedInsightIds, setPinnedInsightIds] = useState<number[]>(recentInsights.map(i => i.id));

  // Helper to format time ago
  const formatTimeAgo = useCallback((dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }, []);

  // Helper to infer chart type from query
  const inferChartType = useCallback((query: string): 'line' | 'bar' | 'pie' | 'area' => {
    const q = query.toLowerCase();
    if (q.includes('group by') && (q.includes('count') || q.includes('sum'))) {
      if (q.includes('date') || q.includes('time') || q.includes('month') || q.includes('year')) {
        return 'line';
      }
      return 'bar';
    }
    if (q.includes('pie') || q.includes('percentage')) {
      return 'pie';
    }
    if (q.includes('area') || (q.includes('cumulative') || q.includes('running'))) {
      return 'area';
    }
    // Default to line for time-based queries
    if (q.includes('date') || q.includes('time') || q.includes('month') || q.includes('year')) {
      return 'line';
    }
    return 'bar';
  }, []);

  // Fetch favorite charts from API
  const fetchFavoriteCharts = useCallback(async () => {
    setIsLoadingCharts(true);
    try {
      const response = await getFavoriteCharts();
      if (response.success && response.data) {
        // Map API response to FavoriteChartData format (includes originalId)
        const mappedCharts: FavoriteChartData[] = response.data.map((chart, index) => ({
          id: parseInt(chart.id.replace(/-/g, '').substring(0, 8), 16) || index + 1, // Convert UUID to number for compatibility
          originalId: chart.id, // Store original UUID for API calls
          name: chart.title,
          description: chart.query.length > 50 ? `Chart query: ${chart.query.substring(0, 50)}...` : `Chart query: ${chart.query}` || 'No description available',
          lastUpdated: formatTimeAgo(chart.created_at),
          chartType: inferChartType(chart.query),
          category: 'Analytics', // Default category
          dashboardName: 'My Dashboard', // Default dashboard name
          dataSource: chart.connection_id || 'Unknown Data Source'
        }));
        setFavoriteCharts(mappedCharts);
      } else {
        toast.error(response.error?.message || "Failed to load favorite charts");
        setFavoriteCharts([]);
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching favorite charts");
      setFavoriteCharts([]);
    } finally {
      setIsLoadingCharts(false);
    }
  }, [formatTimeAgo, inferChartType]);

  // Fetch favorite dashboards from API
  const fetchFavoriteDashboards = useCallback(async () => {
    setIsLoadingDashboards(true);
    try {
      const response = await getFavorites();
      if (response.success && response.data) {
        setFavoriteDashboards(response.data);
      } else {
        toast.error(response.error?.message || "Failed to load favorite dashboards");
        setFavoriteDashboards([]);
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching favorite dashboards");
      setFavoriteDashboards([]);
    } finally {
      setIsLoadingDashboards(false);
    }
  }, []);

  // Load favorite charts and dashboards on mount
  useEffect(() => {
    fetchFavoriteCharts();
    fetchFavoriteDashboards();
  }, [fetchFavoriteCharts, fetchFavoriteDashboards]);

  // Simulate loading insights
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingInsights(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const handleUnpinChart = async (chartId: number, chartName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Find the chart to get its original UUID
    const chart = favoriteCharts.find(c => c.id === chartId);
    if (!chart || !chart.originalId) {
      toast.error("Chart not found");
      return;
    }

    try {
      const updateResponse = await updateFavoriteChart(chart.originalId);
      if (updateResponse.success) {
        // Refresh the favorite charts list
        await fetchFavoriteCharts();
        toast.success(`"${chartName}" unpinned from Home Dashboard`);
      } else {
        toast.error(updateResponse.error?.message || "Failed to unpin chart");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while unpinning chart");
    }
  };

  const handleUnpinInsight = (insightId: number, insightTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedInsightIds(prev => prev.filter(id => id !== insightId));
    toast.success(`"${insightTitle}" unpinned from Home Dashboard`);
  };

  const displayedInsights = recentInsights.filter(insight => pinnedInsightIds.includes(insight.id));

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-[1600px] mx-auto p-10 space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground mb-2">Home</h1>
            <p className="text-muted-foreground">
              Your pinned charts and insights at a glance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.('charts')}
              className="gap-2 hover:bg-muted/50 transition-smooth"
            >
              <Plus className="w-4 h-4" />
              New Chart
            </Button>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => onNavigate?.('dashboards')}
              className="gap-2 hover:bg-muted/50 transition-smooth"
            >
              <Plus className="w-4 h-4" />
              New Dashboard
            </Button>
            {/* <Button 
              onClick={onOpenAIAssistant}
              className="gradient-primary hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-smooth gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Ask VizAI
            </Button> */}
          </div>
        </div>

        {/* Pinned Charts */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground">Pinned Charts</h2>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
              {favoriteCharts.length} charts
            </Badge>
          </div>

          {isLoadingCharts ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 border-2 border-border card-shadow">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                    <div className="h-48 bg-muted/30 rounded-lg animate-pulse" />
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-24" />
                      <div className="flex gap-2">
                        <div className="w-8 h-8 rounded-lg bg-muted/30 animate-pulse" />
                        <div className="w-8 h-8 rounded-lg bg-muted/30 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : favoriteCharts.length === 0 ? (
            <Card className="p-12 border-2 border-dashed border-border card-shadow">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
                  <Star className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-foreground mb-2">No pinned charts yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Pin your most important charts here for quick access from any dashboard
                </p>
                <Button 
                  onClick={() => onNavigate?.('charts')}
                  variant="outline"
                  className="hover:bg-muted/50"
                >
                  Browse Charts
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteCharts.map((chart) => {
                const Icon = chartTypeIcons[chart.chartType];
                const colorClass = chartTypeColors[chart.chartType];
                
                // Determine chart color based on type
                const chartColor = {
                  line: '#06B6D4',
                  bar: '#8B5CF6',
                  pie: '#10B981',
                  area: '#F59E0B'
                }[chart.chartType];

                // Determine which data to use
                const chartData = {
                  line: lineChartData,
                  bar: barChartData,
                  pie: pieChartData,
                  area: areaChartData
                }[chart.chartType];
                
                return (
                  <Card 
                    key={chart.id}
                    className="overflow-hidden border-2 border-border hover:border-primary/30 hover:shadow-xl transition-smooth cursor-pointer group hover-lift card-shadow relative"
                    onClick={() => setSelectedChart(chart)}
                  >
                    {/* Compact Header - Overlaid on chart */}
                    <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-card via-card/95 to-transparent pb-8">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass} transition-smooth group-hover:scale-110`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1.5">
                              {chart.name}
                            </h3>
                            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                              <span className="line-clamp-1">{chart.dashboardName}</span>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{chart.lastUpdated}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleUnpinChart(chart.id, chart.name, e)}
                          className="flex-shrink-0 mt-0.5 p-1 -m-1 rounded-lg hover:bg-primary/10 transition-smooth group/pin"
                          title="Unpin chart"
                        >
                          <Pin className="w-4 h-4 text-primary fill-primary/20 rotate-45 group-hover/pin:fill-primary/40 transition-smooth" />
                        </button>
                      </div>
                    </div>

                    {/* Chart Visualization - Takes up most of the space */}
                    <div className="h-[480px] bg-gradient-to-br from-muted/20 to-muted/5 px-4 pt-32 pb-6">
                      {chart.chartType === 'line' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              dataKey="month" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '2px solid #374151',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#F9FAFB',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
                                padding: '8px 12px'
                              }}
                              labelStyle={{
                                color: '#F9FAFB',
                                fontWeight: 600,
                                marginBottom: '4px'
                              }}
                              itemStyle={{
                                color: '#F9FAFB'
                              }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px' }}
                              verticalAlign="bottom"
                              height={36}
                            />
                            <Line 
                              type="monotone" 
                              dataKey="value" 
                              stroke={chartColor} 
                              strokeWidth={2.5}
                              dot={{ fill: chartColor, r: 3 }}
                              name="Revenue"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                      {chart.chartType === 'bar' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              dataKey="name" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '2px solid #374151',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#F9FAFB',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
                                padding: '8px 12px'
                              }}
                              labelStyle={{
                                color: '#F9FAFB',
                                fontWeight: 600,
                                marginBottom: '4px'
                              }}
                              itemStyle={{
                                color: '#F9FAFB'
                              }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px' }}
                              verticalAlign="bottom"
                              height={36}
                            />
                            <Bar dataKey="value" fill={chartColor} radius={[8, 8, 0, 0]} name="Sales" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                      {chart.chartType === 'pie' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                            <Pie
                              data={chartData}
                              dataKey="value"
                              cx="50%"
                              cy="45%"
                              innerRadius={55}
                              outerRadius={95}
                            >
                              {chartData.map((_entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '2px solid #374151',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#F9FAFB',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
                                padding: '8px 12px'
                              }}
                              labelStyle={{
                                color: '#F9FAFB',
                                fontWeight: 600,
                                marginBottom: '4px'
                              }}
                              itemStyle={{
                                color: '#F9FAFB'
                              }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px' }}
                              verticalAlign="bottom"
                              height={36}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                      {chart.chartType === 'area' && (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                            <XAxis 
                              dataKey="month" 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <YAxis 
                              stroke="hsl(var(--muted-foreground))"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                            />
                            <Tooltip 
                              contentStyle={{
                                backgroundColor: '#1F2937',
                                border: '2px solid #374151',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#F9FAFB',
                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
                                padding: '8px 12px'
                              }}
                              labelStyle={{
                                color: '#F9FAFB',
                                fontWeight: 600,
                                marginBottom: '4px'
                              }}
                              itemStyle={{
                                color: '#F9FAFB'
                              }}
                            />
                            <Legend 
                              wrapperStyle={{ fontSize: '11px' }}
                              verticalAlign="bottom"
                              height={36}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="users" 
                              stroke={chartColor} 
                              fill={chartColor}
                              fillOpacity={0.3}
                              strokeWidth={2.5}
                              name="Active Users"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Hover Action Button */}
                    <div className="absolute bottom-4 right-4 z-10">
                      <GradientButton 
                        size="sm"
                        className="h-8 text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          setSelectedChart(chart);
                        }}
                      >
                        View Details <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </GradientButton>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Favorite Dashboards */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground">Favorite Dashboards</h2>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
              {favoriteDashboards.length} dashboards
            </Badge>
          </div>

          {isLoadingDashboards ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="p-6 border-2 border-border card-shadow">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-muted/50 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                        <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
                      </div>
                    </div>
                    <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />
                  </div>
                </Card>
              ))}
            </div>
          ) : favoriteDashboards.length === 0 ? (
            <Card className="p-12 border-2 border-dashed border-border card-shadow">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
                  <LayoutDashboard className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-foreground mb-2">No favorite dashboards yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Mark dashboards as favorites to access them quickly from your home page
                </p>
                <Button 
                  onClick={() => onNavigate?.('dashboards')}
                  variant="outline"
                  className="hover:bg-muted/50"
                >
                  Browse Dashboards
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteDashboards.map((dashboard) => (
                <Card 
                  key={dashboard.id}
                  className="overflow-hidden border-2 border-border hover:border-primary/30 hover:shadow-xl transition-smooth cursor-pointer group hover-lift card-shadow"
                  onClick={() => onNavigate?.('dashboards')}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0 shadow-md">
                        <LayoutDashboard className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-1">
                          {dashboard.name}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {dashboard.description || 'No description available'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                        Favorite
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.('dashboards');
                        }}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        View <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* AI Insights Preview */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground">Recent Insights</h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onNavigate?.('insights')}
              className="text-primary hover:text-primary hover:bg-primary/10"
            >
              View All <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>

          {isLoadingInsights ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2].map((i) => (
                <Card key={i} className="p-5 border-2 border-border card-shadow">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted/50 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted/50 rounded animate-pulse w-2/3" />
                        <div className="h-3 bg-muted/30 rounded animate-pulse w-1/3" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-full" />
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-5/6" />
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-4/6" />
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                      <div className="h-6 bg-muted/30 rounded-full animate-pulse w-20" />
                      <div className="h-6 bg-muted/30 rounded-full animate-pulse w-16" />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : displayedInsights.length === 0 ? (
            <Card className="p-12 border-2 border-dashed border-border card-shadow">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
                  <Lightbulb className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-foreground mb-2">No pinned insights yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Pin important insights here for quick access and monitoring
                </p>
                <Button 
                  onClick={() => onNavigate?.('insights')}
                  variant="outline"
                  className="hover:bg-muted/50"
                >
                  Browse Insights
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {displayedInsights.map((insight) => {
                const typeConfig = {
                  positive: {
                    icon: TrendingUp,
                    color: 'text-success',
                    bg: 'bg-success/10',
                    border: 'border-success/30'
                  },
                  negative: {
                    icon: TrendingDown,
                    color: 'text-destructive',
                    bg: 'bg-destructive/10',
                    border: 'border-destructive/30'
                  },
                  opportunity: {
                    icon: Lightbulb,
                    color: 'text-warning',
                    bg: 'bg-warning/10',
                    border: 'border-warning/30'
                  }
                };

                const config = typeConfig[insight.type as keyof typeof typeConfig];
                const Icon = config.icon;

                return (
                  <Card 
                    key={insight.id}
                    className={`p-6 border-2 ${config.border} hover:shadow-xl transition-smooth cursor-pointer group hover-lift card-shadow relative`}
                    onClick={() => onNavigate?.('insights')}
                  >
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl ${config.bg} ${config.color} flex items-center justify-center flex-shrink-0 transition-smooth group-hover:scale-110`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-foreground group-hover:text-primary transition-colors mb-2">
                          {insight.title}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                          {insight.description}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleUnpinInsight(insight.id, insight.title, e)}
                        className="flex-shrink-0 p-1 -m-1 rounded-lg hover:bg-primary/10 transition-smooth group/pin"
                        title="Unpin insight"
                      >
                        <Pin className="w-4 h-4 text-primary fill-primary/20 rotate-45 group-hover/pin:fill-primary/40 transition-smooth" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {insight.category}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${insight.impact === 'High' ? 'border-destructive/30 text-destructive' : 'border-warning/30 text-warning'}`}
                        >
                          {insight.impact}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{insight.timestamp}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Chart Preview Dialog */}
      <ChartPreviewDialog
        isOpen={!!selectedChart}
        onClose={() => setSelectedChart(null)}
        chart={selectedChart ? {
          name: selectedChart.name,
          type: selectedChart.chartType,
          description: selectedChart.description,
          query: `SELECT * FROM ${selectedChart.dataSource.toLowerCase().replace(' ', '_')} WHERE date >= '2024-01-01';`,
          reasoning: `This ${selectedChart.chartType} chart analyzes data from ${selectedChart.dataSource} to visualize ${selectedChart.name.toLowerCase()}. The visualization helps identify trends and patterns in ${selectedChart.category.toLowerCase()} metrics.`
        } : null}
        onAddToDashboard={(dashboardId) => {
          console.log('Added to dashboard:', dashboardId);
        }}
        onSaveAsDraft={() => {
          console.log('Saved as draft');
        }}
        isExistingChart={true}
        chartStatus="published"
      />
    </div>
  );
}
