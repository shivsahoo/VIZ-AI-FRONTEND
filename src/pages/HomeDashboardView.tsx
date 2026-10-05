import { useState, useEffect, useCallback } from "react";
import { Pin, TrendingUp, TrendingDown, BarChart3, Lightbulb, Plus, ArrowRight, ArrowUpRight, Clock, Star, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { GradientButton } from "../components/shared/GradientButton";
import { ChartPreviewDialog } from "../components/features/charts/ChartPreviewDialog";
import { toast } from "sonner";
import { PinnedChartData } from "../context/PinnedChartsContext";
import { ChartCard } from "../components/features/charts/ChartCard";
import { getFavoriteCharts, updateFavoriteChart, getFavorites, getChartData, getHomeInsights, deleteHomeInsight, type ChartData as ApiChartData, type HomeInsight } from "../services/api";
import { getDefaultChartDataConfig, inferChartDataConfig, type ChartDataConfig } from "../utils/chartData";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";

interface HomeDashboardViewProps {
  onNavigate?: (tab: string) => void;
  onOpenAIAssistant?: () => void;
}

// Removed hardcoded insights - now fetched from API

const chartTypeIcons = {
  line: TrendingUp,
  bar: BarChart3,
  pie: BarChart3,
  area: TrendingUp
};

// Extended interface to store original API chart ID
interface FavoriteChartData extends PinnedChartData {
  originalId: string; // Store the original UUID from API
  query?: string;
  databaseId?: string;
}

interface FavoriteDashboard {
  id: string;
  name: string;
  description: string;
  user_id: string;
}

interface FavoriteChartDataStatus {
  config: ChartDataConfig;
  metadata?: ApiChartData['metadata'];
  loading: boolean;
  error?: string;
}

export function HomeDashboardView({ onNavigate, onOpenAIAssistant }: HomeDashboardViewProps) {
  const [favoriteCharts, setFavoriteCharts] = useState<FavoriteChartData[]>([]);
  const [favoriteDashboards, setFavoriteDashboards] = useState<FavoriteDashboard[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(true);
  const [selectedChart, setSelectedChart] = useState<FavoriteChartData | null>(null);
  const [homeInsights, setHomeInsights] = useState<HomeInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(true);
  const [favoriteChartDataStatus, setFavoriteChartDataStatus] = useState<Record<string, FavoriteChartDataStatus>>({});
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());

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

  // Helper to normalize chart type from API response
  const normalizeChartType = useCallback((chartType?: string | null): 'line' | 'bar' | 'pie' | 'area' => {
    if (!chartType) {
      return 'line';
    }      
    const normalized = chartType.toString().toLowerCase();
    if (normalized === 'bar' || normalized === 'column') return 'bar';
    if (normalized === 'pie' || normalized === 'donut') return 'pie';
    if (normalized === 'area') return 'area';
    if (normalized === 'stackedlinechart' || normalized === 'stacked_line_chart') return 'line';
    if (normalized === 'stackedhorizontalbar' || normalized === 'stacked_horizontal_bar') return 'bar';
    if (normalized === 'clustering' || normalized === 'cluster' || normalized === 'clustering_chart') return 'line';
    if (normalized === 'line') return 'line';
    return 'line'; // Default fallback
  }, []);

  // Helper to infer chart type from query (fallback)
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
  const fetchChartDataForFavoriteChart = useCallback(async (chart: FavoriteChartData) => {
    const chartKey = chart.originalId;
    const hasQuery = Boolean(chart.query && chart.query.trim().length > 0);
    const hasConnection = Boolean(chart.databaseId && chart.databaseId.trim().length > 0);

    if (!hasQuery || !hasConnection) {
      setFavoriteChartDataStatus((prev) => ({
        ...prev,
        [chartKey]: {
          config: getDefaultChartDataConfig(),
          metadata: undefined,
          loading: false,
          error: !hasQuery
            ? "This chart does not have a saved SQL query."
            : "Database connection ID is missing for this chart.",
        },
      }));
      return;
    }

    setFavoriteChartDataStatus((prev) => ({
      ...prev,
      [chartKey]: {
        ...(prev[chartKey] ?? { config: getDefaultChartDataConfig(), metadata: undefined }),
        loading: true,
        error: undefined,
      },
    }));

    try {
      const response = await getChartData(chartKey, chart.databaseId!, chart.query!);
      if (response.success && response.data) {
        const config = inferChartDataConfig(response.data.data, chart.chartType, {
          xAxisHint: response.data.metadata?.xAxis ?? null,
          yAxisHint: response.data.metadata?.yAxis ?? null,
        });
        setFavoriteChartDataStatus((prev) => ({
          ...prev,
          [chartKey]: {
            config,
            metadata: response.data?.metadata,
            loading: false,
            error: undefined,
          },
        }));
      } else {
        setFavoriteChartDataStatus((prev) => ({
          ...prev,
          [chartKey]: {
            config: getDefaultChartDataConfig(),
            metadata: undefined,
            loading: false,
            error: response.error?.message || "Failed to fetch chart data",
          },
        }));
      }
    } catch (error: any) {
      setFavoriteChartDataStatus((prev) => ({
        ...prev,
        [chartKey]: {
          config: getDefaultChartDataConfig(),
          metadata: undefined,
          loading: false,
          error: error?.message || "Failed to fetch chart data",
        },
      }));
    }
  }, []);

  const fetchFavoriteCharts = useCallback(async () => {
    setIsLoadingCharts(true);
    try {
      const favoriteResponse = await getFavoriteCharts();
      
      if (favoriteResponse.success && favoriteResponse.data) {
        // Map API response to FavoriteChartData format (includes originalId)
        const mappedCharts: FavoriteChartData[] = favoriteResponse.data.map((chart, index) => {
          // Use chart_type from API response directly, fallback to inference if missing
          const actualChartType = chart.chart_type 
            ? normalizeChartType(chart.chart_type) 
            : inferChartType(chart.query);
          
          return {
          id: parseInt(chart.id.replace(/-/g, '').substring(0, 8), 16) || index + 1, // Convert UUID to number for compatibility
          originalId: chart.id, // Store original UUID for API calls
          name: chart.title,
          description: chart.query.length > 50 ? `Chart query: ${chart.query.substring(0, 50)}...` : `Chart query: ${chart.query}` || 'No description available',
          lastUpdated: formatTimeAgo(chart.created_at),
            chartType: actualChartType, // Use chart_type from API response
          category: 'Analytics', // Default category
          dashboardName: 'My Dashboard', // Default dashboard name
          dataSource: chart.connection_id ? `Database ${chart.connection_id}` : 'Unknown Data Source',
          query: chart.query,
          databaseId: chart.connection_id || undefined,
          };
        });
        setFavoriteCharts(mappedCharts);
        setFavoriteChartDataStatus((prev) => {
          const nextStatus: Record<string, FavoriteChartDataStatus> = {};
          mappedCharts.forEach((chart) => {
            nextStatus[chart.originalId] =
              prev[chart.originalId] ?? {
                config: getDefaultChartDataConfig(),
                metadata: undefined,
                loading: false,
                error: undefined,
              };
          });
          return nextStatus;
        });
        mappedCharts.forEach((chart) => {
          fetchChartDataForFavoriteChart(chart);
        });
      } else {
        toast.error(favoriteResponse.error?.message || "Failed to load favorite charts");
        setFavoriteCharts([]);
        setFavoriteChartDataStatus({});
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching favorite charts");
      setFavoriteCharts([]);
      setFavoriteChartDataStatus({});
    } finally {
      setIsLoadingCharts(false);
    }
  }, [fetchChartDataForFavoriteChart, formatTimeAgo, normalizeChartType, inferChartType]);

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

  // Fetch home insights from API
  const fetchHomeInsights = useCallback(async () => {
    setIsLoadingInsights(true);
    try {
      const response = await getHomeInsights(undefined, 10);
      
      if (response.success && response.data) {
        setHomeInsights(response.data);
      } else {
        console.error("Failed to fetch home insights:", response.error);
        toast.error("Failed to load home insights");
      }
    } catch (error) {
      console.error("Error fetching home insights:", error);
    } finally {
      setIsLoadingInsights(false);
    }
  }, []);

  const toggleInsightExpansion = (insightId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click navigation
    setExpandedInsights((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  };

  // Load favorite charts, dashboards, and home insights on mount
  useEffect(() => {
    fetchFavoriteCharts();
    fetchFavoriteDashboards();
    fetchHomeInsights();
  }, [fetchFavoriteCharts, fetchFavoriteDashboards, fetchHomeInsights]);

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

  const handleUnpinInsight = async (insightId: string, insightTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      const deleteResponse = await deleteHomeInsight(insightId);
      if (deleteResponse.success) {
        // Refresh the home insights list
        await fetchHomeInsights();
        toast.success(`"${insightTitle}" removed from Saved Insights`);
      } else {
        toast.error(deleteResponse.error?.message || "Failed to remove insight");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while removing insight");
    }
  };

  // Display home insights from API
  const displayedInsights = homeInsights;
  const selectedChartStatus = selectedChart ? favoriteChartDataStatus[selectedChart.originalId] : undefined;

  const renderFavoriteChartPreview = useCallback((chart: FavoriteChartData) => {
    const status = favoriteChartDataStatus[chart.originalId];
    const hasQueryAndConnection = Boolean(chart.query && chart.databaseId);
    const config = status?.config ?? getDefaultChartDataConfig();
    const isLoading = status ? status.loading : hasQueryAndConnection;
    const error = status?.error;

    return (
      <div className="relative h-full flex items-center justify-center">
        {isLoading && hasQueryAndConnection && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-xl z-10">
            {/* Three dot loader */}
            <div className="flex items-center gap-1.5">
              <span 
                className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
              ></span>
              <span 
                className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                style={{ animationDelay: '200ms', animationDuration: '1.4s' }}
              ></span>
              <span 
                className="w-2 h-2 bg-primary rounded-full animate-bounce" 
                style={{ animationDelay: '400ms', animationDuration: '1.4s' }}
              ></span>
            </div>
          </div>
        )}

        {!isLoading && error && (
          <div className="max-w-xs text-sm text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Unable to load data</p>
            <p>{error}</p>
          </div>
        )}

        {!isLoading && !error && !hasQueryAndConnection && (
          <div className="max-w-xs text-sm text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">Missing configuration</p>
            <p>Pinning this chart requires a saved SQL query and database connection.</p>
          </div>
        )}

        {!isLoading && !error && config.data.length === 0 && hasQueryAndConnection && (
          <div className="max-w-xs text-sm text-muted-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-1">No data returned</p>
            <p>Try refining the SQL query or adjusting filters.</p>
          </div>
        )}

        {!isLoading && !error && config.data.length > 0 && hasQueryAndConnection && (
          <ChartCard
            type={chart.chartType}
            data={config.data}
            dataKeys={[
              config.dataKeys.primary,
              ...(config.dataKeys.secondary ? [config.dataKeys.secondary] : []),
            ]}
            xAxisKey={config.xAxisKey}
            showLegend={!!config.dataKeys.secondary && chart.chartType !== 'pie'}
            height={260}
          />
        )}

      </div>
    );
  }, [favoriteChartDataStatus]);

  const skeletonCards = (count: number, tall: boolean) => (
    <div className="ws-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="home-skel" style={{ height: tall ? 380 : 160, borderRadius: 22 }} />
      ))}
    </div>
  );

  return (
    <div className="min-h-full">
      <div className="ws-page">
        <header className="ws-header">
          <div>
            <h1 className="ws-title">Overview</h1>
            <p className="ws-subtitle">Your pinned charts and saved insights at a glance.</p>
          </div>
          <div className="ws-actions">
            <Button variant="outline" onClick={() => onNavigate?.('charts')} className="ws-primary-btn">
              <Plus className="w-4 h-4" />
              New chart
            </Button>
            <GradientButton onClick={() => onNavigate?.('dashboards')} className="ws-primary-btn">
              <Plus className="w-4 h-4" />
              New dashboard
            </GradientButton>
          </div>
        </header>

        {/* Summary row */}
        <div className="ov-top">
          <section className="ov-hero">
            <span className="ov-hero-icon" aria-hidden="true">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="ov-hero-title">
              Ask your data <span>anything</span>.
            </h2>
            <p className="ov-hero-text">Type a question in plain language. VizAI writes the query, picks the chart, and you pin it here.</p>
            {onOpenAIAssistant && (
              <button type="button" className="ov-hero-btn" onClick={onOpenAIAssistant}>
                Ask a question
                <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </section>
          <button type="button" className="ov-stat" onClick={() => onNavigate?.('charts')}>
            <span className="ov-stat-icon"><Pin className="w-4 h-4" aria-hidden="true" /></span>
            <span className="ov-stat-label">Pinned charts</span>
            <span className="ov-stat-value">{isLoadingCharts ? "–" : favoriteCharts.length}</span>
            <span className="ov-stat-link">Browse charts <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></span>
          </button>
          <button type="button" className="ov-stat ov-stat--dark" onClick={() => onNavigate?.('insights')}>
            <span className="ov-stat-icon"><Lightbulb className="w-4 h-4" aria-hidden="true" /></span>
            <span className="ov-stat-label">Saved insights</span>
            <span className="ov-stat-value">{isLoadingInsights ? "–" : displayedInsights.length}</span>
            <span className="ov-stat-link">Open insights <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" /></span>
          </button>
        </div>

        {/* Pinned Charts */}
        <section className="ws-section">
          <div className="ws-section-head">
            <h2 className="ws-section-title">
              Pinned charts
              {!isLoadingCharts && <span className="ws-count">{favoriteCharts.length}</span>}
            </h2>
          </div>

          {isLoadingCharts ? (
            skeletonCards(3, true)
          ) : favoriteCharts.length === 0 ? (
            <div className="ws-empty">
              <span className="ws-empty-icon">
                <Star className="w-7 h-7" aria-hidden="true" />
              </span>
              <p className="ws-empty-title">No pinned charts yet</p>
              <p className="ws-empty-text">Pin the charts you check most often and they'll show up here.</p>
              <Button variant="outline" onClick={() => onNavigate?.('charts')} className="ws-primary-btn">
                Browse charts
              </Button>
            </div>
          ) : (
            <div className="ws-grid">
              {favoriteCharts.map((chart) => {
                const Icon = chartTypeIcons[chart.chartType as keyof typeof chartTypeIcons] ?? BarChart3;
                const tone = ({ line: 0, bar: 1, pie: 4, donut: 4, area: 3 } as Record<string, number>)[chart.chartType] ?? 0;
                const chartName = chart.name?.trim() || "Untitled Chart";

                return (
                  <div
                    key={chart.id}
                    className="ws-chart-card group"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${chartName}`}
                    onClick={() => setSelectedChart(chart)}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                        e.preventDefault();
                        setSelectedChart(chart);
                      }
                    }}
                  >
                    <div className="ws-chart-head">
                      <span className={`app-tile tone-${tone}`} aria-hidden="true">
                        <Icon className="w-[18px] h-[18px]" />
                      </span>
                      <div className="ws-chart-titles">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <h3 className="ws-chart-title">{chartName}</h3>
                          </TooltipTrigger>
                          <TooltipContent side="top" align="start" className="max-w-xs whitespace-normal break-words">
                            {chartName}
                          </TooltipContent>
                        </Tooltip>
                        <div className="ws-chart-meta">
                          <span>{chart.dashboardName}</span>
                          <span aria-hidden="true">·</span>
                          <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span className="whitespace-nowrap">{chart.lastUpdated}</span>
                        </div>
                      </div>
                      <div className="ws-chart-tools">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => handleUnpinChart(chart.id, chart.name, e)}
                          aria-label={`Unpin ${chartName}`}
                          className="text-primary"
                        >
                          <Pin className="w-4 h-4 fill-primary/20 rotate-45" />
                        </Button>
                      </div>
                    </div>
                    <div className="ws-chart-body">
                      <div className="ws-chart-canvas" style={{ height: 300 }}>
                        {renderFavoriteChartPreview(chart)}
                      </div>
                    </div>
                    <div className="ws-chart-foot">
                      <span className="ws-type-chip">{chart.chartType}</span>
                      <span className="ov-open-link">
                        View details <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Saved insights */}
        <section className="ws-section">
          <div className="ws-section-head">
            <h2 className="ws-section-title">
              Saved insights
              {!isLoadingInsights && <span className="ws-count">{displayedInsights.length}</span>}
            </h2>
            <Button variant="ghost" onClick={() => onNavigate?.('insights')} className="text-primary hover:text-primary">
              View all <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>

          {isLoadingInsights ? (
            skeletonCards(3, false)
          ) : displayedInsights.length === 0 ? (
            <div className="ws-empty">
              <span className="ws-empty-icon">
                <Lightbulb className="w-7 h-7" aria-hidden="true" />
              </span>
              <p className="ws-empty-title">No saved insights yet</p>
              <p className="ws-empty-text">Save insights from the Insights page to keep them one click away.</p>
              <Button variant="outline" onClick={() => onNavigate?.('insights')} className="ws-primary-btn">
                Browse insights
              </Button>
            </div>
          ) : (
            <div className="ws-grid">
              {displayedInsights.map((insight) => {
                const typeConfig = {
                  positive: { icon: TrendingUp, cls: "is-positive", label: "Positive" },
                  negative: { icon: TrendingDown, cls: "is-negative", label: "Risk" },
                  opportunity: { icon: Lightbulb, cls: "is-opportunity", label: "Opportunity" },
                };
                const config =
                  typeConfig[insight.insight_type as keyof typeof typeConfig] ?? typeConfig.opportunity;
                const Icon = config.icon;
                const timeAgo = formatTimeAgo(insight.created_at);
                const isExpanded = expandedInsights.has(insight.id);

                return (
                  <article
                    key={insight.id}
                    className={`ov-insight ${config.cls}`}
                    onClick={() => onNavigate?.('insights')}
                  >
                    <div className="ov-insight-head">
                      <span className="ov-insight-chip">
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        {config.label}
                      </span>
                      <span className="ov-insight-time">{timeAgo}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleUnpinInsight(insight.id, insight.title, e)}
                        aria-label="Remove from saved insights"
                        className="text-primary -mr-2"
                      >
                        <Pin className="w-4 h-4 fill-primary/20 rotate-45" />
                      </Button>
                    </div>
                    <h3 className={`ov-insight-title ${!isExpanded ? 'line-clamp-2' : ''}`}>{insight.title}</h3>
                    <p className={`ov-insight-text ${!isExpanded ? 'line-clamp-3' : ''}`}>{insight.description}</p>
                    {(insight.description.length > 140 || insight.title.length > 80) && (
                      <button
                        type="button"
                        onClick={(e) => toggleInsightExpansion(insight.id, e)}
                        className="ov-insight-more"
                      >
                        {isExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                    <div className="ov-insight-tags">
                      {insight.category && <span className="ws-type-chip">{insight.category}</span>}
                      {insight.impact && (
                        <span className={`ws-type-chip ${insight.impact === 'High' ? 'is-high' : ''}`}>
                          {insight.impact} impact
                        </span>
                      )}
                      {insight.source && <span className="ws-type-chip">{insight.source}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Chart Preview Dialog */}
      <ChartPreviewDialog
        isOpen={!!selectedChart}
        onClose={() => setSelectedChart(null)}
        chart={selectedChart ? {
          id: selectedChart.originalId,
          name: selectedChart.name,
          type: selectedChart.chartType,
          description: selectedChart.description,
          query: selectedChart.query || "",
          reasoning: selectedChart.description || `Pinned chart from ${selectedChart.dashboardName}`,
          dashboards: selectedChart.dashboardName ? [selectedChart.dashboardName] : undefined,
          dataSource: selectedChart.dataSource,
          databaseId: selectedChart.databaseId,
          dataConnectionId: selectedChart.databaseId,
          data: selectedChartStatus?.config.data,
          dataKeys: selectedChartStatus?.config.dataKeys,
          xAxisKey: selectedChartStatus?.config.xAxisKey,
          isLoadingData: selectedChartStatus?.loading,
          dataError: selectedChartStatus?.error,
        } : null}
        dashboards={favoriteDashboards.map((dashboard) => ({
          id: dashboard.id,
          name: dashboard.name,
        }))}
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
