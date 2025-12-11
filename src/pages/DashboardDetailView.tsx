import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Download, Plus, Edit2, X, Pin, Sparkles, Loader2, Calendar as CalendarIcon, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { GradientButton } from "../components/shared/GradientButton";
import { ChartCard } from "../components/features/charts/ChartCard";
import { usePinnedCharts } from "../context/PinnedChartsContext";
import { inferChartDataConfig, getDefaultChartDataConfig } from "../utils/chartData";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Checkbox } from "../components/ui/checkbox";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getDashboardCharts, getChartData, deleteChart, getTeamMembers, addUserToDashboard, type ChartData, type TeamMember } from "../services/api";

// Custom styles for date picker to hide default clear button
if (typeof document !== 'undefined') {
  const styleId = 'datepicker-custom-styles-dashboard';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .react-datepicker__input-container .react-datepicker__close-icon {
        display: none !important;
      }
      .react-datepicker__input-container .react-datepicker__close-icon::after {
        display: none !important;
      }
      /* Fix calendar height to be consistent across all months */
      .react-datepicker__month-container {
        height: 300px !important;
      }
    `;
    document.head.appendChild(style);
  }
}

interface DashboardDetailViewProps {
  dashboardId: string;
  dashboardName: string;
  projectId?: string;
  onBack: () => void;
  onDelete?: (dashboardId: string, dashboardName: string) => void;
  onOpenAIAssistant?: () => void;
  onEditChart?: (chart: { name: string; type: 'line' | 'bar' | 'pie' | 'area'; description?: string }) => void;
  refreshTrigger?: number;
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
  xAxis?: string | null;
  yAxis?: string | null;
  is_time_based?: boolean;
}

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
  projectId: _projectId,
  onBack,
  onDelete: _onDelete,
  onOpenAIAssistant, 
  onEditChart,
  refreshTrigger
}: DashboardDetailViewProps) {
  const { isPinned, togglePin } = usePinnedCharts();
  const [chartToRemove, setChartToRemove] = useState<ChartCardData | null>(null);
  const [charts, setCharts] = useState<ChartCardData[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [chartDateRanges, setChartDateRanges] = useState<Record<string, { startDate: Date | null; endDate: Date | null }>>({});
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);
  
  // Member addition state
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const lastRefreshTriggerRef = useRef<number>(0);

  // Helper to format date as YYYY-MM-DD for API calls
  const formatDateForAPI = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to format date for display (e.g., "Nov 2, 2025")
  const formatDateForDisplay = (date: Date): string => {
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  // Fetch chart data for a specific chart
  const fetchChartData = async (chart: ChartCardData, dateRangeOverride?: { startDate: Date | null; endDate: Date | null }): Promise<ChartData | null> => {
    if (!chart.databaseConnectionId) {
      toast.error("Database connection not available for this chart");
      return null;
    }
    if (!chart.query) {
      toast.error("Chart query not available. Please refresh the page or contact support.");
      return null;
    }

    const chartKey = String(chart.id);
    const dateRange = dateRangeOverride || chartDateRanges[chartKey];

    // Update chart loading state
    setCharts(prev => prev.map(c => 
      c.id === chart.id ? { ...c, isLoadingData: true } : c
    ));

    try {
      // Only send dates if both start and end dates are selected
      const hasBothDates = !!(dateRange?.startDate && dateRange?.endDate);
      const fromDate = hasBothDates && dateRange?.startDate
        ? formatDateForAPI(dateRange.startDate)
        : undefined;
      const toDate = hasBothDates && dateRange?.endDate
        ? formatDateForAPI(dateRange.endDate)
        : undefined;

      const response = await getChartData(
        chart.id, 
        chart.databaseConnectionId, 
        chart.query,
        fromDate,
        toDate
      );
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

  // Fetch team members for adding to dashboard
  const fetchTeamMembers = useCallback(async () => {
    if (!_projectId) {
      toast.error("Project ID is required to add members");
      return;
    }

    setIsLoadingMembers(true);
    try {
      const response = await getTeamMembers(String(_projectId));
      if (response.success && response.data) {
        setTeamMembers(response.data);
      } else {
        toast.error(response.error?.message || "Failed to load team members");
        setTeamMembers([]);
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching team members");
      setTeamMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [_projectId]);

  // Handle opening add member dialog
  const handleOpenAddMemberDialog = () => {
    setSelectedUserIds([]);
    setAddMemberDialogOpen(true);
    fetchTeamMembers();
  };

  // Handle adding users to dashboard
  const handleAddMembers = async () => {
    if (!_projectId) {
      toast.error("Project ID is required");
      return;
    }

    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one user");
      return;
    }

    setIsAddingMembers(true);
    try {
      const response = await addUserToDashboard(String(_projectId), {
        user_ids: selectedUserIds,
        dashboard_id: dashboardId,
      });

      if (response.success) {
        toast.success(`Successfully added ${selectedUserIds.length} user(s) to dashboard`);
        setAddMemberDialogOpen(false);
        setSelectedUserIds([]);
      } else {
        toast.error(response.error?.message || "Failed to add users to dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while adding users");
    } finally {
      setIsAddingMembers(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Fetch charts for the dashboard
  const fetchDashboardCharts = useCallback(async () => {
    if (!dashboardId) return;

    setIsLoadingCharts(true);
    try {
      const response = await getDashboardCharts(dashboardId);
      if (response.success && response.data) {
        // Helper function to normalize chart type
        const normalizeChartType = (chartType: string | null | undefined): 'line' | 'bar' | 'pie' | 'area' => {
          if (!chartType) return 'line'; // Default to line if not provided
          const normalized = chartType.toLowerCase();
          if (normalized === 'bar' || normalized === 'column') return 'bar';
          if (normalized === 'pie' || normalized === 'donut') return 'pie';
          if (normalized === 'area') return 'area';
          if (normalized === 'line') return 'line';
          return 'line'; // Default fallback
        };

        const mappedCharts: ChartCardData[] = response.data.map((chart) => ({
          id: chart.id,
          title: chart.title,
          description: 'No description available',
          type: normalizeChartType(chart.chart_type),
          query: chart.query || '', // Extract query from API response
          databaseConnectionId: chart.connection_id || '',
          created_at: chart.created_at,
          xAxis: (chart as any).x_axis ?? null,
          yAxis: (chart as any).y_axis ?? null,
          is_time_based: chart.is_time_based ?? false,
        }));
        setCharts(mappedCharts);
        
        // Set last updated to the most recent chart's created_at
        if (mappedCharts.length > 0) {
          const mostRecent = mappedCharts.reduce((latest, chart) => 
            new Date(chart.created_at) > new Date(latest.created_at) ? chart : latest
          );
          setLastUpdated(formatTimeAgo(mostRecent.created_at));
        }

        // Automatically execute queries for all charts
        mappedCharts.forEach((chart) => {
          if (chart.query && chart.databaseConnectionId) {
            fetchChartData(chart);
          }
        });
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

  // Load charts on mount
  useEffect(() => {
    fetchDashboardCharts();
  }, [fetchDashboardCharts]);

  // Refresh charts when refreshTrigger changes (e.g., when a chart is added to dashboard)
  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger > 0 && refreshTrigger !== lastRefreshTriggerRef.current) {
      lastRefreshTriggerRef.current = refreshTrigger;
      // Use a small delay to ensure any dialog overlays are fully removed before refreshing
      const timeoutId = setTimeout(() => {
        fetchDashboardCharts();
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [refreshTrigger, fetchDashboardCharts]);

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

  const handleRemoveChart = async (chartId: string) => {
    if (!dashboardId) {
      toast.error("Dashboard ID is missing");
      return;
    }

    try {
      const response = await deleteChart(chartId, dashboardId);
      
      if (response.success) {
        setCharts(prev => prev.filter(chart => chart.id !== chartId));
        toast.success(response.data?.message || `Chart removed from dashboard`);
        setChartToRemove(null);
      } else {
        toast.error(response.error?.message || "Failed to remove chart from dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while removing the chart");
    }
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
      let chartData: ChartData | null | undefined = chart.chartData;
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

  // Prepare chart data for display using the same inference logic as ChartsView
  const getChartDisplayConfig = (chart: ChartCardData) => {
    if (!chart.chartData?.data || chart.chartData.data.length === 0) {
      return getDefaultChartDataConfig();
    }

    // Use inferChartDataConfig to properly identify data keys and x-axis
    // This ensures consistent behavior with ChartsView
    const inferredConfig = inferChartDataConfig(chart.chartData.data, chart.type);

    // Override with explicit x_axis and y_axis from API if available (like DashboardDetailView used to do)
    const metadataYAxis = chart.chartData?.metadata?.yAxis;
    const metadataXAxis = chart.chartData?.metadata?.xAxis;
    
    // Use explicit axis fields if provided, otherwise use inferred values
    const finalDataKeys = {
      primary: metadataYAxis || chart.yAxis || inferredConfig.dataKeys.primary,
      secondary: inferredConfig.dataKeys.secondary, // Keep secondary from inference
    };
    
    const finalXAxisKey = metadataXAxis || chart.xAxis || inferredConfig.xAxisKey;

    return {
      data: inferredConfig.data,
      dataKeys: finalDataKeys,
      xAxisKey: finalXAxisKey,
    };
  };

  const renderDateRangeButton = (chart: ChartCardData) => {
    const chartKey = String(chart.id);
    const isOpen = openDatePicker === chartKey;

    return (
      <div 
        data-date-picker="true"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        className="relative"
      >
        <DatePicker
          selectsRange
          open={isOpen}
          onClickOutside={() => setOpenDatePicker(null)}
          onInputClick={() => {
            setOpenDatePicker(prev => prev === chartKey ? null : chartKey);
          }}
          startDate={chartDateRanges[chartKey]?.startDate || null}
          endDate={chartDateRanges[chartKey]?.endDate || null}
          onChange={(dates) => {
            const [start, end] = dates as [Date | null, Date | null];
            setChartDateRanges(prev => ({
              ...prev,
              [chartKey]: { startDate: start, endDate: end }
            }));
            
            // Fetch data if both dates are set or both are cleared
            if ((start && end) || (!start && !end)) {
              const dateRangeToUse = { startDate: start, endDate: end };
              fetchChartData(chart, dateRangeToUse);
            }
          }}
          placeholderText="Date range"
          dateFormat="MMM d, yyyy"
          showPopperArrow={false}
          popperPlacement="top-end"
          customInput={
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-8 pl-3 pr-3 text-xs bg-white shadow-md hover:bg-gray-50 text-foreground hover:text-foreground border-border relative inline-flex items-center gap-2"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Toggle date picker
                setOpenDatePicker(prev => prev === chartKey ? null : chartKey);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onMouseUp={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-foreground" />
              <span className="text-xs whitespace-nowrap">
                {(() => {
                  const range = chartDateRanges[chartKey];
                  const start = range?.startDate;
                  const end = range?.endDate;
                  if (start && end) {
                    return `${formatDateForDisplay(start)} - ${formatDateForDisplay(end)}`;
                  }
                  if (start) {
                    return `${formatDateForDisplay(start)} - End date`;
                  }
                  return "Date range";
                })()}
              </span>
              {chartDateRanges[chartKey]?.startDate && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setChartDateRanges(prev => ({
                      ...prev,
                      [chartKey]: { startDate: null, endDate: null }
                    }));
                    fetchChartData(chart, { startDate: null, endDate: null });
                  }}
                  className="w-5 h-5 flex items-center justify-center hover:bg-red-100 rounded transition-colors shrink-0"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                >
                  <X className="h-3.5 w-3.5 text-red-600" strokeWidth={2.5} />
                </button>
              )}
            </Button>
          }
        />
      </div>
    );
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
            <Button
              variant="outline"
              onClick={handleOpenAddMemberDialog}
              className="border-border"
            >
              <Users className="w-4 h-4 mr-2" />
              Add Members
            </Button>
            <GradientButton 
              onClick={() => {
                if (onOpenAIAssistant) {
                  onOpenAIAssistant();
                } else {
                  toast.error("AI Assistant is not available");
                }
              }}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Chart
            </GradientButton>
          </div>
        </div>

        {/* Quick Stats - Show chart count */}
        {(() => {
          // Chart type configuration
          const chartTypeConfig: Record<'line' | 'bar' | 'pie' | 'area', { label: string; description: string }> = {
            line: { label: 'Line Charts', description: 'time-series data' },
            bar: { label: 'Bar Charts', description: 'comparison data' },
            pie: { label: 'Pie Charts', description: 'proportion data' },
            area: { label: 'Area Charts', description: 'cumulative data' }
          };

          // Count charts by type
          const chartCounts = charts.reduce((acc, chart) => {
            acc[chart.type] = (acc[chart.type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

          // Get chart types that have at least one chart
          const availableChartTypes = (Object.keys(chartCounts) as Array<'line' | 'bar' | 'pie' | 'area'>)
            .filter(type => chartCounts[type] > 0)
            .sort(); // Sort for consistent ordering

          return (
            <div className="flex flex-wrap gap-6 mb-8">
              {/* Total Charts Card - Always shown */}
              <Card className="p-6 border border-border flex-1 min-w-[200px]">
                <p className="text-sm text-muted-foreground mb-2">Total Charts</p>
                <p className="text-3xl text-foreground mb-1">{charts.length}</p>
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted-foreground">in this dashboard</span>
                </div>
              </Card>
              
              {/* Dynamic Chart Type Cards - Only show types that have charts */}
              {availableChartTypes.map((chartType) => {
                const config = chartTypeConfig[chartType];
                const count = chartCounts[chartType];
                return (
                  <Card key={chartType} className="p-6 border border-border flex-1 min-w-[200px]">
                    <p className="text-sm text-muted-foreground mb-2">{config.label}</p>
                    <p className="text-3xl text-foreground mb-1">{count}</p>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">{config.description}</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        })()}

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
                onClick={() => {
                  if (onOpenAIAssistant) {
                    onOpenAIAssistant();
                  } else {
                    toast.error("AI Assistant is not available");
                  }
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Chart
              </GradientButton>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {charts.map((chart) => {
              const chartConfig = getChartDisplayConfig(chart);
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
                    {/* <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-border hover:bg-muted"
                      onClick={() => handleEditChart(chart)}
                      title="Edit Chart"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button> */}
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
                  ) : chartConfig.data.length > 0 ? (
                    <ChartCard
                      type={chart.type}
                      data={chartConfig.data}
                      dataKeys={chartConfig.dataKeys}
                      xAxisKey={chartConfig.xAxisKey}
                      height={300}
                      showLegend={!!chartConfig.dataKeys.secondary && chart.type !== 'pie'}
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

                  {/* Date Range Picker - Bottom Right */}
                  {chart.is_time_based === true && (
                    <div className="mt-4 flex justify-end">
                      {renderDateRangeButton(chart)}
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

        {/* Add Members Dialog */}
        <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Members to Dashboard</DialogTitle>
              <DialogDescription>
                Select team members to add to this dashboard. Only users with a role in this project can be added.
              </DialogDescription>
            </DialogHeader>
            
            <div className="py-4">
              {isLoadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="ml-3 text-muted-foreground">Loading team members...</span>
                </div>
              ) : teamMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No team members found in this project.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={`member-${member.id}`}
                        checked={selectedUserIds.includes(member.id)}
                        onCheckedChange={() => toggleUserSelection(member.id)}
                      />
                      <Label
                        htmlFor={`member-${member.id}`}
                        className="flex-1 cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-foreground">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="ml-2">
                          {member.role}
                        </Badge>
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAddMemberDialogOpen(false);
                  setSelectedUserIds([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMembers}
                disabled={selectedUserIds.length === 0 || isAddingMembers || isLoadingMembers}
              >
                {isAddingMembers ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    Add {selectedUserIds.length > 0 ? `${selectedUserIds.length} ` : ''}Member{selectedUserIds.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}