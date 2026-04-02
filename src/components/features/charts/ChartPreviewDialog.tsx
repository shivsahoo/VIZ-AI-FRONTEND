import { Plus, ChevronDown, LayoutDashboard, Clock, Loader2, MessageSquare, Sparkles, Microscope } from "lucide-react";
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
import { ProbeModeDialog } from "./ProbeModeDialog";

interface PreviewChart {
  id?: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area' | 'none' | string; // Added 'none' and string for conversation
  description?: string;
  query?: string;
  reasoning?: string;
  interaction?: string; // Added for conversational text
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
  /** Passed through so ProbeModeDialog can include schema context on first message */
  db_schema?: string;
  db_type?: string;
}

interface ChartPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chart: PreviewChart | null;
  dashboards?: Array<{ id: string | number; name: string }>;
  projectId?: string | number;
  onAddToDashboard?: (dashboardId: number | string) => void;
  onSaveAsDraft?: (savedChart?: SavedChart) => void;
  onGenerateCharts?: () => void; // <--- NEW PROP for the button
  isExistingChart?: boolean;
  chartStatus?: 'draft' | 'published';
}

export function ChartPreviewDialog({ 
  isOpen, 
  onClose, 
  chart, 
  dashboards = [], 
  projectId, 
  onAddToDashboard, 
  onSaveAsDraft, 
  onGenerateCharts, 
  isExistingChart = false, 
  chartStatus: _chartStatus 
}: ChartPreviewDialogProps) {
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const isSavingDraftRef = React.useRef(false);
  const [isAddingToDashboard, setIsAddingToDashboard] = React.useState(false);
  const [isProbeModeOpen, setIsProbeModeOpen] = React.useState(false);
  const [addingToDashboardId, setAddingToDashboardId] = React.useState<number | string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const isAddingToDashboardRef = React.useRef(false);
  const pendingDashboardCallbackRef = React.useRef<number | string | null>(null);
  const [chartDataConfig, setChartDataConfig] = React.useState<ChartDataConfig>(() => getDefaultChartDataConfig());
  const [chartDataMetadata, setChartDataMetadata] = React.useState<ApiChartData['metadata'] | undefined>(undefined);
  const [chartDataError, setChartDataError] = React.useState<string | undefined>(undefined);
  const [isExecutingQuery, setIsExecutingQuery] = React.useState(false);
  const [windowWidth, setWindowWidth] = React.useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Check if this is a conversational response rather than a real chart
  const isConversational = chart?.type?.toLowerCase() === 'none' || !!chart?.interaction;

  // Track window width for responsive chart height
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); 
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getChartHeight = () => {
    if (windowWidth < 640) return 200; 
    if (windowWidth < 768) return 250;  
    if (windowWidth < 1024) return 280; 
    return 320; 
  };

  // Reset dropdown state when dialog closes
  React.useEffect(() => {
    if (!isOpen) {
      setIsDropdownOpen(false);
      setIsAddingToDashboard(false);
      setAddingToDashboardId(null);
      setIsProbeModeOpen(false);
      isAddingToDashboardRef.current = false;
      pendingDashboardCallbackRef.current = null;
      
      const cleanupTimeout = setTimeout(() => {
        const dropdownPortals = document.querySelectorAll('[data-slot="dropdown-menu-portal"]');
        dropdownPortals.forEach(portal => {
          try {
            if (portal.parentNode) portal.parentNode.removeChild(portal);
          } catch (e) {}
        });
        
        const radixPortals = document.querySelectorAll('[data-radix-portal]');
        radixPortals.forEach(portal => {
          const isDropdownPortal = portal.querySelector('[data-slot="dropdown-menu-content"]');
          if (isDropdownPortal) {
            try {
              if (portal.parentNode) portal.parentNode.removeChild(portal);
            } catch (e) {}
          }
        });
      }, 100);
      
      return () => clearTimeout(cleanupTimeout);
    }
  }, [isOpen]);
  
  React.useEffect(() => {
    if (!chart) {
      setChartDataConfig(getDefaultChartDataConfig());
      setChartDataMetadata(undefined);
      setChartDataError(undefined);
      setIsExecutingQuery(false);
      return;
    }

    if (isConversational) {
      setChartDataConfig(getDefaultChartDataConfig());
      setIsExecutingQuery(false);
      return;
    }

    if (chart.data && chart.dataKeys && chart.xAxisKey) {
      let processedData = chart.data;
      if ((chart.type === 'line' || chart.type === 'area') && chart.data.length > 0) {
        processedData = [...chart.data].sort((a, b) => {
          const aVal = a[chart.xAxisKey!];
          const bVal = b[chart.xAxisKey!];
          
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            const aDate = new Date(aVal).getTime();
            const bDate = new Date(bVal).getTime();
            if (!isNaN(aDate) && !isNaN(bDate)) {
              return aDate - bDate;
            }
            return aVal.localeCompare(bVal);
          }
          
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal;
          }
          
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
  }, [chart, isConversational]);

  React.useEffect(() => {
    if (!isOpen || !chart || isConversational) {
      if (isConversational) {
        setIsExecutingQuery(false);
        setChartDataError(undefined);
      }
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

        if (cancelled) return;

        if (response.success && response.data) {
          const config = inferChartDataConfig(response.data.data, chart.type as any);
          setChartDataConfig(config);
          setChartDataMetadata(response.data.metadata);
          setChartDataError(undefined);
        } else {
          setChartDataConfig(getDefaultChartDataConfig());
          setChartDataMetadata(undefined);
          setChartDataError(response.error?.message || "Failed to fetch chart data");
        }
      } catch (error: any) {
        if (cancelled) return;
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
  }, [isOpen, chart?.id, chart?.query, chart?.type, chart?.databaseId, chart?.dataConnectionId, chart?.dataSource, isConversational]);
  
  const extractDatabaseId = () => {
    if (chart?.databaseId) return String(chart.databaseId);
    if (chart?.dataConnectionId) return String(chart.dataConnectionId);

    let databaseId: string | undefined;
    const dbIdMatch = chart?.dataSource?.match(/Database ([^\s]+)/);
    if (dbIdMatch) {
      databaseId = dbIdMatch[1];
    } else {
      databaseId =
        chart?.dataSource && chart.dataSource !== "Unknown" && chart.dataSource !== "Unknown Database"
          ? chart.dataSource
          : undefined;
    }

    return databaseId;
  };

  const validateDatabaseId = (databaseId?: string): databaseId is string => {
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
      chart?.xAxisKey || chart?.xAxisField || chart?.spec?.x_axis || chartDataMetadata?.xAxis || chartDataConfig.xAxisKey;

    const resolvedYAxis =
      chart?.dataKeys?.primary || chart?.yAxisField || chart?.spec?.y_axis || chartDataMetadata?.yAxis || chartDataConfig.dataKeys.primary;

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

    if (isAddingToDashboardRef.current) return;

    const databaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();

    if (!validateDatabaseId(databaseId)) {
      toast.error("A valid database connection is required.");
      return;
    }

    setIsDropdownOpen(false);
    await new Promise(resolve => setTimeout(resolve, 50));
    
    isAddingToDashboardRef.current = true;
    setIsAddingToDashboard(true);
    setAddingToDashboardId(dashboardId);

    try {
      const axisFields = resolveAxisFields();
      const isTimeBased = chart.spec?.type === 'time_series' ? true : 
                         chart.spec?.type === 'aggregate' ? false :
                         chart.spec?.is_time_based ?? false;

      const response = await addChartToDashboard({
        title: chart.name,
        query: chart.query || "",
        report: chart.reasoning || chart.description || "",
        type: chart.type as 'line' | 'bar' | 'pie' | 'area', // TypeScript fix
        relevance: "",
        is_time_based: isTimeBased,
        chart_type: chart.type as 'line' | 'bar' | 'pie' | 'area', // TypeScript fix
        dashboard_id: String(dashboardId),
        data_connection_id: databaseId,
        x_axis: axisFields.xAxis || undefined,
        y_axis: axisFields.yAxis || undefined,
      });

      if (response.success) {
        const dashboard = dashboards.find((d) => String(d.id) === String(dashboardId));
        toast.success(`Chart added to "${dashboard?.name || "dashboard"}"!`);
        setIsDropdownOpen(false);
        await new Promise(resolve => setTimeout(resolve, 100));
        pendingDashboardCallbackRef.current = dashboardId;
        setIsAddingToDashboard(false);
        setAddingToDashboardId(null);
        onClose();
      } else {
        toast.error(response.error?.message || "Failed to add chart to dashboard");
        setIsAddingToDashboard(false);
        setAddingToDashboardId(null);
        isAddingToDashboardRef.current = false;
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while adding chart to dashboard");
      setIsAddingToDashboard(false);
      setAddingToDashboardId(null);
      isAddingToDashboardRef.current = false;
    }
  };

  const handleSaveAsDraft = async () => {
    if (!chart || !projectId) {
      toast.error("Chart or project information is missing");
      return;
    }

    if (isSavingDraftRef.current) return;

    const databaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();

    if (!validateDatabaseId(databaseId)) {
      toast.error("A valid database connection is required.");
      return;
    }

    const axisFields = resolveAxisFields();
    const isTimeBased = chart.spec?.type === 'time_series' ? true : 
                       chart.spec?.type === 'aggregate' ? false :
                       chart.spec?.is_time_based ?? false;

    isSavingDraftRef.current = true;
    setIsSavingDraft(true);
    try {
      const response = await createChart(String(projectId), {
        name: chart.name,
        type: chart.type as 'line' | 'bar' | 'pie' | 'area', // TypeScript fix
        query: chart.query,
        databaseId,
        is_time_based: isTimeBased,
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

  const handleApplyProbeChanges = (modifiedSql: string, modifiedSpec?: Partial<ChartSpec>) => {
    if (!chart) return;
    // Re-run the query execution effect by updating chart.query via toast + triggering
    // a state refresh in the parent.  Since ChartPreviewDialog owns its own query state
    // locally we force a re-fetch by mutating chartDataConfig and re-triggering the effect.
    setChartDataConfig(getDefaultChartDataConfig());
    setChartDataError(undefined);
    setIsExecutingQuery(true);

    const databaseId = chart.databaseId || chart.dataConnectionId || extractDatabaseId();
    getChartData(chart.id ?? "probe-apply", databaseId ?? "", modifiedSql)
      .then((response) => {
        if (response.success && response.data) {
          const config = inferChartDataConfig(
            response.data.data,
            (modifiedSpec?.chart_type ?? chart.type) as any
          );
          setChartDataConfig(config);
          setChartDataMetadata(response.data.metadata);
          setChartDataError(undefined);
        } else {
          setChartDataError(response.error?.message || "Failed to fetch updated chart data");
        }
      })
      .catch((err) => setChartDataError(err?.message || "Failed to fetch updated chart data"))
      .finally(() => setIsExecutingQuery(false));
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsDropdownOpen(false);
      setIsAddingToDashboard(false);
      setAddingToDashboardId(null);
      
      if (pendingDashboardCallbackRef.current !== null) {
        const dashboardId = pendingDashboardCallbackRef.current;
        pendingDashboardCallbackRef.current = null;
        
        const callbackTimeout = setTimeout(() => {
          const dropdownPortals = document.querySelectorAll('[data-slot="dropdown-menu-portal"]');
          dropdownPortals.forEach(portal => {
            try {
              if (portal.parentNode) portal.parentNode.removeChild(portal);
            } catch (e) {}
          });
          
          const allPortals = document.querySelectorAll('[data-radix-portal]');
          allPortals.forEach(portal => {
            const hasDropdownContent = portal.querySelector('[data-slot="dropdown-menu-content"]');
            if (hasDropdownContent) {
              try {
                if (portal.parentNode) portal.parentNode.removeChild(portal);
              } catch (e) {}
            }
          });
          
          setTimeout(() => {
            isAddingToDashboardRef.current = false;
            onAddToDashboard?.(dashboardId);
          }, 50);
        }, 400); 
        
        return () => clearTimeout(callbackTimeout);
      } else {
        isAddingToDashboardRef.current = false;
      }
      
      onClose();
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="!w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] sm:!w-[85vw] sm:!max-w-[85vw] md:!max-w-xl lg:!max-w-2xl xl:!max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col p-0">
        
        {/* Fixed Header */}
        <DialogHeader className="px-3 sm:px-4 md:px-5 pt-3 sm:pt-4 md:pt-5 pb-2 sm:pb-3 flex-shrink-0 pr-12 sm:pr-14 relative">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5" style={{ paddingRight: '60px' }}>
                <DialogTitle className="text-sm sm:text-base flex-1 min-w-0 truncate whitespace-nowrap">
                  {isConversational ? "VizAI Message" : chart.name}
                </DialogTitle>
                
                {!isConversational && (
                  <Badge variant="outline" className="capitalize w-fit text-xs flex-shrink-0">
                    {chart.type} Chart
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs break-words line-clamp-2">
                {isConversational 
                  ? "AI Assistant Response" 
                  : (chart.description || chart.reasoning || "Review the chart details before saving or adding it to a dashboard.")}
              </DialogDescription>
              
              {!isConversational && chart.dashboards && chart.dashboards.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <LayoutDashboard className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground mt-2">Part of:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-5 min-h-0">
          <div className="bg-muted/30 rounded-lg border border-border p-2 sm:p-3 md:p-4 mb-4">
            <div className="relative w-full" style={{ height: `${getChartHeight()}px` }}>
              
              {isConversational ? (
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <div className="flex flex-col items-center max-w-md bg-background/60 p-6 rounded-xl border border-border shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl mb-4">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                    <p className="text-sm md:text-base text-foreground leading-relaxed text-center font-medium">
                      {chart.interaction || chart.reasoning || chart.description || chart.name}
                    </p>
                  </div>
                </div>
              ) : missingConfigMessage ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="max-w-xs text-sm text-muted-foreground leading-relaxed text-center">
                    {missingConfigMessage}
                  </div>
                </div>
              ) : (
                <>
                  {isExecutingQuery && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm text-muted-foreground z-10">
                      <Clock className="w-5 h-5 animate-spin" />
                      <span className="text-xs">Executing query…</span>
                    </div>
                  )}
                  {!isExecutingQuery && chartDataError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="max-w-xs text-sm text-muted-foreground leading-relaxed text-center">
                        <p className="font-medium text-foreground mb-1">Unable to load data</p>
                        <p>{chartDataError}</p>
                      </div>
                    </div>
                  )}
                  {!isExecutingQuery && !chartDataError && noDataReturned && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="max-w-xs text-sm text-muted-foreground leading-relaxed text-center">
                        <p className="font-medium text-foreground mb-1">No data returned</p>
                        <p>Try refining the SQL query or adjusting filters.</p>
                      </div>
                    </div>
                  )}
                  {!isExecutingQuery && !chartDataError && !noDataReturned && (
                    <ChartCard
                      type={chart.type as any}
                      data={chartDataConfig.data}
                      dataKeys={chartDataConfig.dataKeys}
                      xAxisKey={chartDataConfig.xAxisKey}
                      showLegend={!!chartDataConfig.dataKeys.secondary && chart.type !== 'pie'}
                      height={getChartHeight()}
                    />
                  )}
                </>
              )}
            </div>

            {!isConversational && !missingConfigMessage && chartDataMetadata && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {typeof chartDataMetadata.executionTime === 'number' && chartDataMetadata.executionTime > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md border border-border bg-background/50 text-xs">
                    {chartDataMetadata.executionTime} ms
                  </span>
                )}
                {cachedAtDisplay && (
                  <span className="px-1.5 py-0.5 rounded-md border border-border bg-background/50 text-xs">
                    Cached at {cachedAtDisplay}
                  </span>
                )}
              </div>
            )}
          </div>

          {!isConversational && (
            <div className="space-y-3 pb-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">AI Reasoning:</p>
                <div className="text-xs text-foreground bg-muted/50 p-2.5 rounded-lg break-words max-h-[200px] overflow-y-auto">
                  {chart.reasoning || "No reasoning summary provided."}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-medium">SQL Query:</p>
                <pre className="text-xs bg-muted/50 p-2.5 pl-4 rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
                  <code className="text-foreground break-words whitespace-pre-wrap">
                    {chart.query || "-- No query provided --"}
                  </code>
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Footer based on Conversation vs Chart */}
        {isConversational ? (
          <div className="flex flex-row items-stretch gap-2 pt-2 border-t border-border px-3 sm:px-4 md:px-5 pb-3 sm:pb-4 md:pb-5 bg-background flex-shrink-0 sticky bottom-0">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
            >
              Cancel
            </Button>
            <GradientButton 
              className="gap-1.5 flex-1 text-xs sm:text-sm h-8 sm:h-9"
              onClick={() => {
                onClose();
                onGenerateCharts?.();
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Let AI Generate Charts
            </GradientButton>
          </div>
        ) : (
          <div className="flex flex-row items-stretch gap-2 pt-2 border-t border-border px-3 sm:px-4 md:px-5 pb-3 sm:pb-4 md:pb-5 bg-background flex-shrink-0 sticky bottom-0">
            {!isExistingChart && (
              <Button
                variant="outline"
                onClick={handleSaveAsDraft}
                disabled={isSavingDraft}
                className="flex-1 text-xs sm:text-sm h-8 sm:h-9"
              >
                {isSavingDraft ? "Saving..." : "Save for later"}
              </Button>
            )}

            {/* Probe Mode button — only for real charts with a SQL query */}
            {!isConversational && hasQuery && (
              <Button
                variant="outline"
                onClick={() => setIsProbeModeOpen(true)}
                className="flex-1 text-xs sm:text-sm h-8 sm:h-9 gap-1.5"
              >
                <Microscope className="w-3.5 h-3.5" />
                Probe Mode
              </Button>
            )}
            
            <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <GradientButton 
                  className="gap-1.5 flex-1 text-xs sm:text-sm h-8 sm:h-9"
                  disabled={isAddingToDashboard}
                >
                  {isAddingToDashboard ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                  <Plus className="w-3.5 h-3.5" />
                  Add to Dashboard
                  <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </GradientButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-[calc(100vw-2rem)] sm:w-[250px] max-w-[250px] !z-[100]" 
                onCloseAutoFocus={(e) => e.preventDefault()}
                onEscapeKeyDown={() => setIsDropdownOpen(false)}
                onPointerDownOutside={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-slot="dropdown-menu-trigger"]')) {
                    e.preventDefault();
                  }
                }}
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
        )}
      </DialogContent>
    </Dialog>

    {/* Probe Mode — separate dialog with its own isolated WS connection */}
    {chart && (
      <ProbeModeDialog
        isOpen={isProbeModeOpen}
        onClose={() => setIsProbeModeOpen(false)}
        chart={{
          name: chart.name,
          type: chart.type,
          query: chart.query,
          spec: chart.spec,
          dataConnectionId: chart.dataConnectionId,
          databaseId: chart.databaseId,
          db_schema: chart.db_schema,
          db_type: chart.db_type,
        }}
        onApplyChanges={handleApplyProbeChanges}
      />
    )}
  </>
  );
}