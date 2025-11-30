import { Plus, ChevronDown, LayoutDashboard, Clock, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { GradientButton } from "../../shared/GradientButton";
import { Badge } from "../../ui/badge";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "../../ui/dropdown-menu";
import { ChartCard } from "./ChartCard";
import { toast } from "sonner";
import { addChartToDashboard, createChart, getChartData, type Chart as SavedChart, type ChartData as ApiChartData } from "../../../services/api";
import { getDefaultChartDataConfig, inferChartDataConfig, type ChartDataConfig } from "../../../utils/chartData";
import * as React from "react";
import type { ChartSpec } from "../../../services/websocket";

interface PreviewChart {
  id?: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  description?: string;
  query?: string;
  reasoning?: string;
  dashboards?: string[];
  dataSource?: string;
  databaseId?: string;
  dataConnectionId?: string;
  data?: any[];
  dataKeys?: {
    primary: string;
    secondary?: string;
  };
  xAxisKey?: string;
  isLoadingData?: boolean;
  dataError?: string;
  spec?: ChartSpec;
  xAxisField?: string | null;
  yAxisField?: string | null;
  minMaxDates?: [string, string] | null;
}

interface ChartPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chart: PreviewChart | null;
  dashboards?: Array<{ id: string | number; name: string }>; // Real dashboards from API
  projectId?: string | number;
  onAddToDashboard?: (dashboardId: number | string) => void; // Callback after API call succeeds
  onSaveAsDraft?: (savedChart?: SavedChart) => void;
  isExistingChart?: boolean;
  chartStatus?: 'draft' | 'published';
}

interface Dashboard {
  id: number | string;
  name: string;
}

export function ChartPreviewDialog({ isOpen, onClose, chart, dashboards = [], projectId, onAddToDashboard, onSaveAsDraft, isExistingChart = false, chartStatus }: ChartPreviewDialogProps) {
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const isSavingDraftRef = React.useRef(false);
  const [isAddingToDashboard, setIsAddingToDashboard] = React.useState(false);
  const [addingToDashboardId, setAddingToDashboardId] = React.useState<number | string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [chartDataConfig, setChartDataConfig] = React.useState<ChartDataConfig>(() => getDefaultChartDataConfig());
  const [chartDataMetadata, setChartDataMetadata] = React.useState<ApiChartData['metadata'] | undefined>(undefined);
  const [chartDataError, setChartDataError] = React.useState<string | undefined>(undefined);
  const [isExecutingQuery, setIsExecutingQuery] = React.useState(false);
  // Debug logging
  React.useEffect(() => {
    if (isOpen && chart) {
      console.log('ChartPreviewDialog opened:', {
        dashboardsCount: dashboards.length,
        dashboards,
        projectId,
        chartName: chart.name
      });
    }
  }, [isOpen, chart, dashboards, projectId]);
  
  React.useEffect(() => {
    if (!chart) {
      setChartDataConfig(getDefaultChartDataConfig());
      setChartDataMetadata(undefined);
      setChartDataError(undefined);
      setIsExecutingQuery(false);
      return;
    }

    if (chart.data && chart.dataKeys && chart.xAxisKey) {
      // Ensure data is sorted for line/area charts even when pre-populated
      let processedData = chart.data;
      if ((chart.type === 'line' || chart.type === 'area') && chart.data.length > 0) {
        processedData = [...chart.data].sort((a, b) => {
          const aVal = a[chart.xAxisKey!];
          const bVal = b[chart.xAxisKey!];
          
          // Handle date strings
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const aDate = new Date(aVal).getTime();
            const bDate = new Date(bVal).getTime();
            if (!isNaN(aDate) && !isNaN(bDate)) {
              return aDate - bDate;
            }
            return aVal.localeCompare(bVal);
          }
          
          // Handle numeric values
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          
          // Fallback to string comparison
          return String(aVal).localeCompare(String(bVal));
        });
      }
      
      setChartDataConfig({
        data: processedData,
        dataKeys: chart.dataKeys,
        xAxisKey: chart.xAxisKey,
      });
    } else {
      setChartDataConfig(getDefaultChartDataConfig());
    }

    setChartDataMetadata(undefined);
    setChartDataError(chart.dataError);
    setIsExecutingQuery(chart.isLoadingData ?? false);
  }, [chart]);

  React.useEffect(() => {
    if (!isOpen || !chart) {
      return;
    }

    const hasQuery = Boolean(chart.query && chart.query.trim().length > 0);
    const databaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();

    if (!hasQuery) {
      setChartDataError("No SQL query available for this chart.");
      setIsExecutingQuery(false);
      return;
    }

    if (!databaseId) {
      setChartDataError("A valid database connection is required to preview data.");
      setIsExecutingQuery(false);
      return;
    }

    if (chart.data && chart.data.length > 0 && !chart.isLoadingData && !chart.dataError) {
      return;
    }

    let cancelled = false;

    const executeQuery = async () => {
      setIsExecutingQuery(true);
      setChartDataError(undefined);

      try {
        const response = await getChartData(chart.id ?? "preview", databaseId, chart.query!);

        if (cancelled) {
          return;
        }

        if (response.success && response.data) {
          const config = inferChartDataConfig(response.data.data, chart.type);
          setChartDataConfig(config);
          setChartDataMetadata(response.data.metadata);
          setChartDataError(undefined);
        } else {
          setChartDataConfig(getDefaultChartDataConfig());
          setChartDataMetadata(undefined);
          setChartDataError(response.error?.message || "Failed to fetch chart data");
        }
      } catch (error: any) {
        if (cancelled) {
          return;
        }
        setChartDataConfig(getDefaultChartDataConfig());
        setChartDataMetadata(undefined);
        setChartDataError(error?.message || "Failed to fetch chart data");
      } finally {
        if (!cancelled) {
          setIsExecutingQuery(false);
        }
      }
    };

    executeQuery();

    return () => {
      cancelled = true;
    };
  }, [isOpen, chart?.id, chart?.query, chart?.type, chart?.databaseId, chart?.dataConnectionId, chart?.dataSource]);
  
  const extractDatabaseId = () => {
    if (chart?.databaseId) {
      return String(chart.databaseId);
    }

    if (chart?.dataConnectionId) {
      return String(chart.dataConnectionId);
    }

    // Try format "Database {id}" first (supports UUIDs)
    let databaseId: string | undefined;
    const dbIdMatch = chart?.dataSource?.match(/Database ([^\s]+)/);
    if (dbIdMatch) {
      databaseId = dbIdMatch[1];
    } else {
      // If not in "Database {id}" format, check if dataSource is the ID directly
      databaseId =
        chart?.dataSource && chart.dataSource !== "Unknown" && chart.dataSource !== "Unknown Database"
          ? chart.dataSource
          : undefined;
    }

    return databaseId;
  };

  const validateDatabaseId = (databaseId?: string) => {
    return !!databaseId && databaseId.trim().length > 0;
  };

  if (!chart) return null;

  const resolvedDatabaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();
  const hasQuery = Boolean(chart.query && chart.query.trim().length > 0);
  const hasConnection = Boolean(resolvedDatabaseId);
  const missingConfigMessage = !hasQuery
    ? "This chart does not include an SQL query yet. Ask VizAI to generate one before previewing."
    : !hasConnection
      ? "Please select a valid database connection before previewing this chart."
      : undefined;
  const noDataReturned =
    !isExecutingQuery && !chartDataError && chartDataConfig.data.length === 0;
  const cachedAtDisplay =
    chartDataMetadata?.cachedAt && !Number.isNaN(Date.parse(chartDataMetadata.cachedAt))
      ? new Date(chartDataMetadata.cachedAt).toLocaleString()
      : chartDataMetadata?.cachedAt ?? null;

  const resolveAxisFields = () => {
    const resolvedXAxis =
      chart?.xAxisKey ||
      chart?.xAxisField ||
      chart?.spec?.x_axis ||
      chartDataMetadata?.xAxis ||
      chartDataConfig.xAxisKey;

    const resolvedYAxis =
      chart?.dataKeys?.primary ||
      chart?.yAxisField ||
      chart?.spec?.y_axis ||
      chartDataMetadata?.yAxis ||
      chartDataConfig.dataKeys.primary;

    return {
      xAxis: resolvedXAxis ?? null,
      yAxis: resolvedYAxis ?? null,
    };
  };

  const handleAddToDashboard = async (dashboardId: number | string) => {
    if (!chart || !projectId) {
      toast.error("Chart or project information is missing");
      return;
    }

    const databaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();

    if (!validateDatabaseId(databaseId)) {
      toast.error("A valid database connection is required. Please select a database when creating the chart.");
      console.error("ChartPreviewDialog: Invalid or missing database ID", {
        dataSource: chart.dataSource,
        extractedId: databaseId,
        chart: chart.name,
      });
      return;
    }

    setIsAddingToDashboard(true);
    setAddingToDashboardId(dashboardId);
    setIsDropdownOpen(false); // Close dropdown to show loading state in button

    try {
    const axisFields = resolveAxisFields();

    const response = await addChartToDashboard({
        title: chart.name,
        query: chart.query || "",
        report: chart.reasoning || chart.description || "",
        type: chart.type,
        relevance: "",
      is_time_based: chart.spec?.is_time_based ?? false,
        chart_type: chart.type,
        dashboard_id: String(dashboardId),
        data_connection_id: databaseId,
      x_axis: axisFields.xAxis || undefined,
      y_axis: axisFields.yAxis || undefined,
      });

      if (response.success) {
        const dashboard = dashboards.find((d) => String(d.id) === String(dashboardId));
        toast.success(`Chart added to "${dashboard?.name || "dashboard"}"!`);
        onAddToDashboard?.(dashboardId);
        onClose();
      } else {
        toast.error(response.error?.message || "Failed to add chart to dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while adding chart to dashboard");
    } finally {
      setIsAddingToDashboard(false);
      setAddingToDashboardId(null);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!chart || !projectId) {
      toast.error("Chart or project information is missing");
      return;
    }

    // Reentry guard: prevent duplicate POSTs
    if (isSavingDraftRef.current) {
      return;
    }

    const databaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();

    if (!validateDatabaseId(databaseId)) {
      toast.error("A valid database connection is required. Please select a database when creating the chart.");
      console.error("ChartPreviewDialog: Invalid or missing database ID for draft save", {
        dataSource: chart.dataSource,
        extractedId: databaseId,
        chart: chart.name,
      });
      return;
    }

    const axisFields = resolveAxisFields();

    isSavingDraftRef.current = true;
    setIsSavingDraft(true);
    try {
      const response = await createChart(String(projectId), {
        name: chart.name,
        type: chart.type,
        query: chart.query,
        databaseId,
        config: {
          xAxis: axisFields.xAxis || undefined,
          yAxis: axisFields.yAxis || undefined,
        },
      });

      if (response.success && response.data) {
        toast.success(`Chart "${chart.name}" saved as draft!`);
        onSaveAsDraft?.(response.data);
        onClose();
      } else {
        toast.error(response.error?.message || "Failed to save chart as draft");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while saving chart as draft");
    } finally {
      setIsSavingDraft(false);
      isSavingDraftRef.current = false;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <DialogTitle>{chart.name}</DialogTitle>
                <Badge variant="outline" className="capitalize">
                  {chart.type} Chart
                </Badge>
              </div>
              <DialogDescription>
                {chart.description || chart.reasoning || "Review the chart details before saving or adding it to a dashboard."}
              </DialogDescription>
              
              {/* Show dashboards this chart belongs to */}
              {chart.dashboards && chart.dashboards.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Part of:</span>
                  <div className="flex flex-wrap gap-2">
                    {chart.dashboards.map((dashboard, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {dashboard}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Chart Visualization */}
        <div className="flex-1 min-h-0 bg-muted/30 rounded-lg border border-border p-6">
          <div className="relative w-full h-[400px] flex items-center justify-center text-center">
            {missingConfigMessage ? (
              <div className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                {missingConfigMessage}
              </div>
            ) : (
              <>
                {isExecutingQuery && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm text-muted-foreground">
                    <Clock className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Executing query…</span>
                  </div>
                )}
                {!isExecutingQuery && chartDataError && (
                  <div className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                    <p className="font-medium text-foreground mb-1">Unable to load data</p>
                    <p>{chartDataError}</p>
                  </div>
                )}
                {!isExecutingQuery && !chartDataError && noDataReturned && (
                  <div className="max-w-xs text-sm text-muted-foreground leading-relaxed">
                    <p className="font-medium text-foreground mb-1">No data returned</p>
                    <p>Try refining the SQL query or adjusting filters.</p>
                  </div>
                )}
                {!isExecutingQuery && !chartDataError && !noDataReturned && (
                  <ChartCard
                    type={chart.type}
                    data={chartDataConfig.data}
                    dataKeys={chartDataConfig.dataKeys}
                    xAxisKey={chartDataConfig.xAxisKey}
                    showLegend={!!chartDataConfig.dataKeys.secondary && chart.type !== 'pie'}
                    height={400}
                  />
                )}
              </>
            )}
          </div>

          {!missingConfigMessage && chartDataMetadata && (
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {typeof chartDataMetadata.executionTime === 'number' && chartDataMetadata.executionTime > 0 && (
                <span className="px-2 py-1 rounded-md border border-border bg-background/50">
                  {chartDataMetadata.executionTime} ms
                </span>
              )}
              {cachedAtDisplay && (
                <span className="px-2 py-1 rounded-md border border-border bg-background/50">
                  Cached at {cachedAtDisplay}
                </span>
              )}
            </div>
          )}
        </div>

        {/* SQL Query Section */}
        <div className="space-y-3 max-h-48 overflow-y-auto">
          <div>
            <p className="text-sm text-muted-foreground mb-2">AI Reasoning:</p>
            <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">
              {chart.reasoning || "No reasoning summary provided."}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">SQL Query:</p>
            <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto">
              <code className="text-foreground">
                {chart.query || "-- No query provided --"}
              </code>
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          {/* Only show Save as Draft button if it's not an existing published chart */}
          {(!isExistingChart || chartStatus !== 'published') && (
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={isSavingDraft}
            >
              {isSavingDraft ? "Saving..." : "Save for later"}
            </Button>
          )}
          
          <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <GradientButton 
                className="gap-2" 
                disabled={isAddingToDashboard}
              >
                {isAddingToDashboard ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                <Plus className="w-4 h-4" />
                Add to Dashboard
                <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </GradientButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-[250px] !z-[99999]" 
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DropdownMenuLabel>Select a dashboard</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {dashboards && dashboards.length > 0 ? (
                dashboards.map((dashboard) => {
                  const isAddingToThis = isAddingToDashboard && addingToDashboardId === dashboard.id;
                  return (
                <DropdownMenuItem
                  key={dashboard.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('Dashboard selected:', dashboard);
                      handleAddToDashboard(dashboard.id);
                    }}
                      disabled={isAddingToDashboard}
                      className="flex items-center gap-2"
                >
                      {isAddingToThis && <Loader2 className="w-3 h-3 animate-spin" />}
                  {dashboard.name}
                  </DropdownMenuItem>
                  );
                })
              ) : (
                <DropdownMenuItem disabled className="text-muted-foreground">
                  No dashboards available. Please create a dashboard first.
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogContent>
    </Dialog>
  );
}
