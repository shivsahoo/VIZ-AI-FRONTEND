import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Download, Plus, Edit2, X, Pin, Sparkles, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { GradientButton } from "../components/shared/GradientButton";
import { ChartCard } from "../components/features/charts/ChartCard";
import { usePinnedCharts } from "../context/PinnedChartsContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import { filterCharts, getChartData, type ChartData } from "../services/api";

interface DashboardDetailViewProps {
  dashboardId: string;
  dashboardName: string;
  projectId?: string;
  onBack: () => void;
  onOpenAIAssistant?: () => void;
  onEditChart?: (chart: { name: string; type: 'line' | 'bar' | 'pie' | 'area'; description?: string }) => void;
}

interface ChartCardData {
  id: string;
  title: string;
  description: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  query: string;
  databaseConnectionId: string;
  created_at: string;
  chartData?: ChartData;
  isLoadingData?: boolean;
  isExporting?: boolean;
}

// Helper to map backend chart type to frontend type
const mapChartType = (backendType: string): 'line' | 'bar' | 'pie' | 'area' => {
  const typeMap: Record<string, 'line' | 'bar' | 'pie' | 'area'> = {
    line: 'line',
    bar: 'bar',
    pie: 'pie',
    area: 'area',
  };
  return typeMap[backendType.toLowerCase()] || 'line';
};

// Helper to format time ago
const formatTimeAgo = (dateString: string): string => {
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
};

export function DashboardDetailView({ 
  dashboardId, 
  dashboardName, 
  projectId,
  onBack, 
  onOpenAIAssistant, 
  onEditChart 
}: DashboardDetailViewProps) {
  const { isPinned, togglePin } = usePinnedCharts();
  const [chartToRemove, setChartToRemove] = useState<ChartCardData | null>(null);
  const [charts, setCharts] = useState<ChartCardData[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Fetch charts for the dashboard
  const fetchDashboardCharts = useCallback(async () => {
    if (!dashboardId) return;

    setIsLoadingCharts(true);
    try {
      const response = await filterCharts({ dashboardId });
      if (response.success && response.data) {
        const mappedCharts: ChartCardData[] = response.data.map((chart) => ({
          id: chart.id,
          title: chart.title,
          description: chart.query.length > 100 ? `${chart.query.substring(0, 100)}...` : chart.query || 'No description',
          type: mapChartType(chart.chart_type || chart.type),
          query: chart.query,
          databaseConnectionId: chart.database_connection_id,
          created_at: chart.created_at,
        }));
        setCharts(mappedCharts);
        
        // Set last updated to the most recent chart's created_at
        if (mappedCharts.length > 0) {
          const mostRecent = mappedCharts.reduce((latest, chart) => 
            new Date(chart.created_at) > new Date(latest.created_at) ? chart : latest
          );
          setLastUpdated(formatTimeAgo(mostRecent.created_at));
        }
      } else {
        toast.error(response.error?.message || "Failed to load dashboard charts");
        setCharts([]);
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching dashboard charts");
      setCharts([]);
    } finally {
      setIsLoadingCharts(false);
    }
  }, [dashboardId]);

  // Fetch chart data for a specific chart
  const fetchChartData = async (chart: ChartCardData): Promise<ChartData | null> => {
    if (!chart.databaseConnectionId || !chart.query) {
      toast.error("Chart query or database connection not available");
      return null;
    }

    // Update chart loading state
    setCharts(prev => prev.map(c => 
      c.id === chart.id ? { ...c, isLoadingData: true } : c
    ));

    try {
      const response = await getChartData(chart.id, chart.databaseConnectionId, chart.query);
      if (response.success && response.data) {
        setCharts(prev => prev.map(c => 
          c.id === chart.id ? { ...c, chartData: response.data, isLoadingData: false } : c
        ));
        return response.data;
      } else {
        toast.error(response.error?.message || "Failed to load chart data");
        setCharts(prev => prev.map(c => 
          c.id === chart.id ? { ...c, isLoadingData: false } : c
        ));
        return null;
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching chart data");
      setCharts(prev => prev.map(c => 
        c.id === chart.id ? { ...c, isLoadingData: false } : c
      ));
      return null;
    }
  };

  // Load charts on mount
  useEffect(() => {
    fetchDashboardCharts();
  }, [fetchDashboardCharts]);

  const handleEditChart = (chart: ChartCardData) => {
    // Pass chart info to parent
    if (onEditChart) {
      onEditChart({
        name: chart.title,
        type: chart.type,
        description: chart.description
      });
    }
    // Open AI Assistant for editing
    if (onOpenAIAssistant) {
      onOpenAIAssistant();
    }
  };

  const handleRemoveChart = (chartId: string) => {
    setCharts(prev => prev.filter(chart => chart.id !== chartId));
    toast.success(`Chart removed from dashboard`);
    setChartToRemove(null);
    // TODO: Call API to remove chart from dashboard
  };

  const handleTogglePin = (chartData: ChartCardData) => {
    // Create a numeric ID from the string ID (hash it)
    const numericId = parseInt(chartData.id.replace(/-/g, '').substring(0, 8), 16) || 0;

    const pinnedChartData = {
      id: numericId,
      name: chartData.title,
      description: chartData.description,
      lastUpdated: formatTimeAgo(chartData.created_at),
      chartType: chartData.type,
      category: chartData.type.charAt(0).toUpperCase() + chartData.type.slice(1),
      dashboardName: dashboardName,
      dataSource: chartData.databaseConnectionId || 'Unknown Data Source'
    };
    
    togglePin(pinnedChartData);
    
    if (isPinned(numericId)) {
      toast.success(`"${chartData.title}" unpinned from Home Dashboard`);
    } else {
      toast.success(`"${chartData.title}" pinned to Home Dashboard`);
    }
  };

  const convertDataToCSV = (rows: any[]): string => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return "";
    }

    if (typeof rows[0] !== "object" || rows[0] === null) {
      return rows.map((value) => {
        const sanitized = value === undefined || value === null ? "" : String(value);
        return `"${sanitized.replace(/"/g, '""')}"`;
      }).join("\n");
    }

    const headers = Array.from(
      rows.reduce((keys: Set<string>, row) => {
        Object.keys(row ?? {}).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    );

    const escapeCell = (cell: any) => {
      if (cell === null || cell === undefined) return "";
      const cellString =
        typeof cell === "object" ? JSON.stringify(cell) : String(cell);
      const needsEscaping = /[",\n\r]/.test(cellString);
      const escapedValue = cellString.replace(/"/g, '""');
      return needsEscaping ? `"${escapedValue}"` : escapedValue;
    };

    const csvRows = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escapeCell(row?.[header])).join(",")),
    ];

    return csvRows.join("\n");
  };

  const sanitizeFilename = (title: string) => {
    const fallback = "chart-export";
    return (title || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "") || fallback;
  };

  const handleExportChart = async (chart: ChartCardData) => {
    setCharts(prev =>
      prev.map(c =>
        c.id === chart.id ? { ...c, isExporting: true } : c
      )
    );

    try {
      let chartData = chart.chartData;
      if (!chartData?.data || chartData.data.length === 0) {
        chartData = await fetchChartData(chart);
      }

      if (!chartData || !chartData.data || chartData.data.length === 0) {
        toast.error("No data available to export for this chart");
        return;
      }

      const csvContent = convertDataToCSV(chartData.data);
      if (!csvContent) {
        toast.error("Failed to generate CSV content for this chart");
        return;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${sanitizeFilename(chart.title)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(`"${chart.title}" exported as CSV`);
    } catch (error: any) {
      toast.error(error?.message || "Failed to export chart");
    } finally {
      setCharts(prev =>
        prev.map(c =>
          c.id === chart.id ? { ...c, isExporting: false } : c
        )
      );
    }
  };

  // Prepare chart data for display
  const getChartDisplayData = (chart: ChartCardData) => {
    if (chart.chartData?.data && chart.chartData.data.length > 0) {
      return chart.chartData.data;
    }
    // Return empty data array if no data loaded yet
    return [];
  };

  // Determine data keys based on chart type
  const getDataKeys = (chart: ChartCardData, data: any[]) => {
    if (data.length === 0) return { primary: 'value' };
    
    const keys = Object.keys(data[0]);
    if (keys.length >= 2) {
      return { primary: keys[1], secondary: keys.length > 2 ? keys[2] : undefined };
    }
    return { primary: keys[0] };
  };

  const getXAxisKey = (data: any[]) => {
    if (data.length === 0) return 'name';
    const keys = Object.keys(data[0]);
    return keys[0] || 'name';
  };

  return (
    <div className="px-12 py-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={onBack}
              className="border-border"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h2 className="text-2xl text-foreground mb-1">{dashboardName}</h2>
              <div className="flex items-center gap-3">
                <p className="text-muted-foreground text-sm">
                  {isLoadingCharts
                    ? "Loading..."
                    : charts.length === 0
                      ? "No charts yet"
                      : lastUpdated
                        ? `Last updated ${lastUpdated}`
                        : "Last updated just now"}
                </p>
                <Badge variant="outline" className="border-success/30 text-success bg-success/10">
                  Live
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-border">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <GradientButton 
              onClick={onOpenAIAssistant}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Chart
            </GradientButton>
          </div>
        </div>

        {/* Quick Stats - Show chart count */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Total Charts</p>
            <p className="text-3xl text-foreground mb-1">{charts.length}</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">in this dashboard</span>
            </div>
          </Card>
          
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Line Charts</p>
            <p className="text-3xl text-foreground mb-1">{charts.filter(c => c.type === 'line').length}</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">time-series data</span>
            </div>
          </Card>
          
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Bar Charts</p>
            <p className="text-3xl text-foreground mb-1">{charts.filter(c => c.type === 'bar').length}</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">comparison data</span>
            </div>
          </Card>
          
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Other Charts</p>
            <p className="text-3xl text-foreground mb-1">{charts.filter(c => c.type !== 'line' && c.type !== 'bar').length}</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">pie, area, etc.</span>
            </div>
          </Card>
        </div>

        {/* Charts Grid */}
        {isLoadingCharts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading dashboard charts...</span>
          </div>
        ) : charts.length === 0 ? (
          <Card className="p-12 border-2 border-dashed border-border">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mb-5">
                <Sparkles className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-foreground mb-2">No charts in this dashboard</h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                Add charts to this dashboard to visualize your data
              </p>
              <GradientButton 
                onClick={onOpenAIAssistant}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Chart
              </GradientButton>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {charts.map((chart) => {
              const chartData = getChartDisplayData(chart);
              const dataKeys = getDataKeys(chart, chartData);
              const xAxisKey = getXAxisKey(chartData);
              const numericId = parseInt(chart.id.replace(/-/g, '').substring(0, 8), 16) || 0;
              const isChartPinned = isPinned(numericId);

              return (
                <Card key={chart.id} className="p-6 border border-border relative group">
                  {/* Chart Actions */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-8 w-8 border-border ${
                        isChartPinned
                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleTogglePin(chart)}
                      title={isChartPinned ? "Unpin from Home" : "Pin to Home"}
                    >
                      <Pin className={`w-4 h-4 ${isChartPinned ? 'fill-primary/20 rotate-45' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-border hover:bg-muted disabled:opacity-60"
                      onClick={() => handleExportChart(chart)}
                      title="Export chart data as CSV"
                      disabled={chart.isExporting}
                    >
                      {chart.isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-border hover:bg-muted"
                      onClick={() => handleEditChart(chart)}
                      title="Edit Chart"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-border hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setChartToRemove(chart)}
                      title="Remove Chart"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg text-foreground mb-1">{chart.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{chart.description}</p>
                  </div>
                  {chart.isLoadingData ? (
                    <div className="h-[300px] flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading chart data...</span>
                    </div>
                  ) : chartData.length > 0 ? (
                    <ChartCard
                      type={chart.type}
                      data={chartData}
                      dataKeys={dataKeys}
                      xAxisKey={xAxisKey}
                      height={300}
                    />
                  ) : (
                    <div className="h-[300px] flex items-center justify-center border border-dashed border-border rounded-lg">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">No data available</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fetchChartData(chart)}
                        >
                          Load Data
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Remove Chart Confirmation Dialog */}
        <AlertDialog open={!!chartToRemove} onOpenChange={() => setChartToRemove(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Chart from Dashboard</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove "{chartToRemove?.title}" from this dashboard? 
                The chart will still be available in your Charts library.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => chartToRemove && handleRemoveChart(chartToRemove.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}