import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, Download, Plus, X, Pin, Sparkles, Loader2, Calendar as CalendarIcon, Globe, Telescope, Link2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { GradientButton } from "../components/shared/GradientButton";
import { ChartCard } from "../components/features/charts/ChartCard";
import { usePinnedCharts } from "../context/PinnedChartsContext";
import { inferChartDataConfig, getDefaultChartDataConfig, isExtendedChartType, inferExtendedChartConfig, extendedToChartDataConfig } from "../utils/chartData";
import { ChartType } from "../components/features/charts/core/chartTypes";
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
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getDashboardCharts, getChartData, deleteChart, addChartToDashboard, getCurrentUser, generateDashboardKpiQueries, executeKpiQuery, regenerateDashboardKpiQuery, updateDashboard, type ChartData, type KpiQueryDescriptor } from "../services/api";
import { ShareLinkModal } from "../components/features/dashboards/ShareLinkModal";
import { AllowedDomainsSection } from "../components/features/dashboards/AllowedDomainsSection";
import { ProbeModeDialog } from "../components/features/charts/ProbeModeDialog";
import { VizAIWebSocket, type ChartSpec } from "../services/websocket";
import { Skeleton } from "../components/ui/skeleton";
import { KpiInfographicsRow } from "../components/features/dashboards/KpiInfographicsRow";

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

interface AutopilotConfig {
  dashboardId: string;
  kpiGoals: string;
  connectionId: string;
  dbSchema: string;
  dbType: string;
  isPbitGenerated?: boolean;
}

/** Strip noise words and extract top thematic nouns from chart titles. */
function deriveNameFromChartTitles(titles: string[]): string {
  const noiseWords = new Set([
    "total", "by", "and", "or", "the", "of", "in", "for", "to", "a", "an",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "could", "should", "may", "might",
    "chart", "graph", "report", "analysis", "overview", "summary", "vs", "per",
    "top", "bottom", "count", "number", "amount", "value", "rate", "ratio",
    "monthly", "weekly", "daily", "yearly", "annual", "trend", "trends",
    "with", "from", "over", "time", "based", "all", "each", "this", "that",
  ]);

  const wordCounts: Record<string, number> = {};
  titles.forEach((title) => {
    title
      .split(/[\s\-_,()]+/)
      .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
      .filter((w) => w.length > 2 && !noiseWords.has(w))
      .forEach((word) => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
  });

  const topWords = Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));

  if (topWords.length === 0) return "Business Dashboard";
  if (topWords.length === 1) return `${topWords[0]} Dashboard`;
  return `${topWords[0]} & ${topWords[1]} Dashboard`;
}

interface DashboardDetailViewProps {
  dashboardId: string;
  dashboardName: string;
  projectId?: string;
  onBack: () => void;
  onDelete?: (dashboardId: string, dashboardName: string) => void;
  onOpenAIAssistant?: () => void;
  onEditChart?: (chart: { name: string; type: ChartType; description?: string }) => void;
  refreshTrigger?: number;
  /** Present when this dashboard was just created via Autopilot mode */
  autopilotConfig?: AutopilotConfig;
  /** Called once autopilot chart generation has been initiated, so parent can clear the config */
  onAutopilotConsumed?: () => void;
  /** Whether this is an Autopilot Dashboard (drives KPI infographic display) */
  isAutopilot?: boolean;
  /** Previously saved KPI query descriptors (if already generated) */
  savedKpiQueries?: KpiQueryDescriptor[] | null;
  /** Callback to sync dashboard state up to parent */
  onDashboardUpdated?: (dashboardId: string, updates: any) => void;
}

interface ChartCardData {
  id: string;
  title: string;
  description: string;
  type: ChartType;
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
  refreshTrigger,
  autopilotConfig,
  onAutopilotConsumed,
  isAutopilot = false,
  savedKpiQueries,
  onDashboardUpdated,
}: DashboardDetailViewProps) {
  const { isPinned, togglePin } = usePinnedCharts();
  const [localDashboardName, setLocalDashboardName] = useState(dashboardName);
  const [chartToRemove, setChartToRemove] = useState<ChartCardData | null>(null);
  const [charts, setCharts] = useState<ChartCardData[]>([]);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [chartDateRanges, setChartDateRanges] = useState<Record<string, { startDate: Date | null; endDate: Date | null }>>({});
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);

  // Share link modal state
  const [shareLinkModalOpen, setShareLinkModalOpen] = useState(false);
  const [allowedDomainsCount, setAllowedDomainsCount] = useState(0);
  const lastRefreshTriggerRef = useRef<number>(0);

  // Autopilot Dashboard generation state
  const [isGeneratingAutopilot, setIsGeneratingAutopilot] = useState(false);
  const [autopilotError, setAutopilotError] = useState<string | null>(null);
  const [autopilotSkeletonCount, setAutopilotSkeletonCount] = useState(0);
  const [autopilotConnectionInfo, setAutopilotConnectionInfo] = useState<AutopilotConfig | null>(null);
  const autopilotWsRef = useRef<VizAIWebSocket | null>(null);
  const autopilotConsumedRef = useRef(false);
  const isGeneratingAutopilotRef = useRef(false);

  // KPI Infographics state (all dashboards)
  const [kpiDescriptors, setKpiDescriptors] = useState<KpiQueryDescriptor[]>(savedKpiQueries ?? []);
  const [kpiValues, setKpiValues] = useState<Record<string, number | null>>({});
  const [kpiErrors, setKpiErrors] = useState<Record<string, boolean>>({});
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiGenerationError, setKpiGenerationError] = useState<string | null>(null);
  const kpiGeneratedRef = useRef(false);  // prevent duplicate generation

  // Probe Mode state
  const [probeChart, setProbeChart] = useState<ChartCardData | null>(null);

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
        toDate,
        false,
        { xAxis: chart.xAxis ?? null, yAxis: chart.yAxis ?? null }
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



  // Fetch charts for the dashboard
  const fetchDashboardCharts = useCallback(async () => {
    if (!dashboardId) return;

    setIsLoadingCharts(true);
    try {
      const response = await getDashboardCharts(dashboardId);
      if (response.success && response.data) {
        // Helper function to normalize chart type
        const normalizeChartType = (chartType: string | null | undefined): ChartType => {
          if (!chartType) return 'line'; // Default to line if not provided
          const normalized = chartType.toLowerCase();
          if (normalized === 'column') return 'bar';
          if (normalized === 'donut') return 'donut';
          if (normalized === 'stacked_line_chart') return 'stackedlinechart';
          if (normalized === 'stacked_horizontal_bar') return 'stackedhorizontalbar';
          if (normalized === 'cluster' || normalized === 'clustering_chart') return 'clustering';
          if (normalized === 'multi_y_axis') return 'multiyaxischart';
          return normalized as ChartType;
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

  // Execute stored KPI queries and populate kpiValues
  const runKpiQueries = useCallback(async (descriptors: KpiQueryDescriptor[]) => {
    if (!descriptors || descriptors.length === 0) return;
    // Reset values so cards show loading skeletons
    setKpiValues({});
    setKpiErrors({});
    
    let activeDescriptors = [...descriptors];
    let hasChanges = false;
    
    // Execute all queries in parallel
    await Promise.allSettled(
      descriptors.map(async (kpi) => {
        if (!kpi.connection_id) {
          setKpiErrors((prev) => ({ ...prev, [kpi.label]: true }));
          return;
        }
        
        let currentQuery = kpi.query;
        let currentKpi = kpi;
        let attempt = 0;
        const maxRetries = 3;
        
        while (attempt <= maxRetries) {
          try {
            const value = await executeKpiQuery(currentKpi.connection_id!, currentQuery);
            if (value !== 0 && value !== null && value !== undefined) {
              setKpiValues((prev) => ({ ...prev, [currentKpi.label]: value }));
              return; // Success
            }
          } catch (err) {
            // Execution failed, proceed to retry
          }
          
          attempt++;
          if (attempt > maxRetries) {
            // Exhausted retries, hide card by removing it
            activeDescriptors = activeDescriptors.filter(d => d.label !== currentKpi.label);
            hasChanges = true;
            return;
          }
          
          // Try to regenerate via backend
          try {
            const regenResp = await regenerateDashboardKpiQuery(dashboardId!, {
              connection_id: currentKpi.connection_id!,
              label: currentKpi.label,
              failed_query: currentQuery,
            });
            if (regenResp.success && regenResp.data?.kpi?.query) {
              currentQuery = regenResp.data.kpi.query;
              currentKpi = regenResp.data.kpi;
              // Update active descriptors with the new KPI properties
              activeDescriptors = activeDescriptors.map(d => d.label === currentKpi.label ? currentKpi : d);
              hasChanges = true;
            } else {
              activeDescriptors = activeDescriptors.filter(d => d.label !== currentKpi.label);
              hasChanges = true;
              return;
            }
          } catch {
            activeDescriptors = activeDescriptors.filter(d => d.label !== currentKpi.label);
            hasChanges = true;
            return;
          }
        }
      })
    );
    
    if (hasChanges) {
      setKpiDescriptors(activeDescriptors);
    }
  }, [dashboardId]);

  // KPI Infographics — load for all dashboards (Autopilot uses config; manual uses chart's connection)
  useEffect(() => {
    // If descriptors are already in state (from savedKpiQueries prop), just run them
    if (kpiDescriptors.length > 0) {
      runKpiQueries(kpiDescriptors);
      return;
    }

    if (isAutopilot) {
      // Autopilot path — needs autopilotConfig for connection/schema
      if (!autopilotConfig) return;

      const generateAndRun = async () => {
        setKpiLoading(true);
        setKpiGenerationError(null);
        try {
          const resp = await generateDashboardKpiQueries(dashboardId, {
            connection_id: autopilotConfig.connectionId,
            db_schema: autopilotConfig.dbSchema,
            db_type: autopilotConfig.dbType,
            num_kpis: 5,
          });
          if (resp.success && resp.data) {
            const descriptors = resp.data.kpi_queries;
            setKpiDescriptors(descriptors);
            onDashboardUpdated?.(dashboardId, { kpiQueries: descriptors });
            await runKpiQueries(descriptors);
          } else {
            setKpiGenerationError(resp.error?.message ?? "Failed to generate KPI metrics");
          }
        } catch (err: any) {
          setKpiGenerationError(err.message ?? "Failed to generate KPI metrics");
        } finally {
          setKpiLoading(false);
        }
      };

      generateAndRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutopilot, dashboardId]);

  // For non-autopilot dashboards (or autopilot missing config): trigger KPI generation after charts are loaded
  useEffect(() => {
    if (isAutopilot && autopilotConfig) return; // fresh autopilot handled above
    if (isLoadingCharts) return;               // wait for charts to finish loading
    if (kpiGeneratedRef.current) return;       // already generated
    if (kpiDescriptors.length > 0) return;     // already have descriptors

    // Find first chart with a valid connection_id
    const firstConnectedChart = charts.find(c => !!c.databaseConnectionId);
    if (!firstConnectedChart) return;          // no connection available

    kpiGeneratedRef.current = true;            // lock to prevent re-run

    const generateAndRun = async () => {
      setKpiLoading(true);
      setKpiGenerationError(null);
      try {
        const resp = await generateDashboardKpiQueries(dashboardId, {
          connection_id: firstConnectedChart.databaseConnectionId,
          // db_schema & db_type omitted — backend fetches them from the connection record
          num_kpis: 5,
        });
        if (resp.success && resp.data) {
          const descriptors = resp.data.kpi_queries;
          setKpiDescriptors(descriptors);
          onDashboardUpdated?.(dashboardId, { kpiQueries: descriptors });
          await runKpiQueries(descriptors);
        } else {
          setKpiGenerationError(resp.error?.message ?? "Failed to generate KPI metrics");
          kpiGeneratedRef.current = false;     // allow retry
        }
      } catch (err: any) {
        setKpiGenerationError(err.message ?? "Failed to generate KPI metrics");
        kpiGeneratedRef.current = false;       // allow retry
      } finally {
        setKpiLoading(false);
      }
    };

    generateAndRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutopilot, isLoadingCharts, charts.length, dashboardId]);

  // Autopilot Dashboard — trigger chart generation via WebSocket on mount
  useEffect(() => {
    if (!autopilotConfig || autopilotConsumedRef.current) return;
    if (autopilotConfig.dashboardId !== dashboardId) return;

    autopilotConsumedRef.current = true;
    onAutopilotConsumed?.();

    const NUM_CHARTS = 6;
    setIsGeneratingAutopilot(true);
    isGeneratingAutopilotRef.current = true;
    setAutopilotSkeletonCount(NUM_CHARTS);
    setAutopilotConnectionInfo(autopilotConfig);

    const startGeneration = async () => {
      try {
        // Get current user for WebSocket auth
        const userResp = await getCurrentUser();
        const userId = userResp.success && userResp.data?.id ? String(userResp.data.id) : "guest";

        const ws = new VizAIWebSocket(userId);
        autopilotWsRef.current = ws;

        await ws.connect();

        let completedChartCount = 0;

        ws.on("chart_creation", async (response) => {
          if (response.status === "error") {
            setAutopilotError(response.error || "Failed to generate charts. Please try again.");
            isGeneratingAutopilotRef.current = false;
            setIsGeneratingAutopilot(false);
            setAutopilotSkeletonCount(0);
            ws.disconnect();
            return;
          }

          // The LLM auto-starter path returns status="collecting" (not "completed") with
          // chart_specs embedded in state. Accept both statuses — only act when specs exist.
          const hasChartSpecs =
            Array.isArray(response.state?.chart_specs) &&
            (response.state!.chart_specs as ChartSpec[]).length > 0;

          if (
            (response.status === "completed" || response.status === "collecting") &&
            hasChartSpecs
          ) {
            const chartSpecs: ChartSpec[] = response.state!.chart_specs as ChartSpec[];

            for (const spec of chartSpecs) {
              if (!spec.title || !spec.query) continue;

              try {
                // Save chart to dashboard
                const saveResp = await addChartToDashboard({
                  title: spec.title,
                  query: spec.query,
                  chart_type: spec.chart_type as any,
                  type: spec.chart_type as any,
                  dashboard_id: dashboardId,
                  data_connection_id: autopilotConfig.connectionId,
                  report: spec.report || "",
                  relevance: String(spec.relevance ?? 0.8),
                  is_time_based: spec.is_time_based ?? false,
                  x_axis: spec.x_axis ?? null,
                  y_axis: spec.y_axis ?? null,
                });

                if (!saveResp.success || !saveResp.data?.chart_id) continue;

                const chartId = saveResp.data.chart_id;
                completedChartCount++;

                // Build a placeholder card — data loads asynchronously below
                const newCard: ChartCardData = {
                  id: chartId,
                  title: spec.title,
                  description: spec.report || "",
                  type: spec.chart_type as ChartType,
                  query: spec.query,
                  databaseConnectionId: autopilotConfig.connectionId,
                  created_at: new Date().toISOString(),
                  isLoadingData: true,
                  xAxis: spec.x_axis ?? null,
                  yAxis: spec.y_axis ?? null,
                  is_time_based: spec.is_time_based ?? false,
                };

                // Replace one skeleton with the real card
                setCharts((prev) => [...prev, newCard]);
                setAutopilotSkeletonCount((n) => Math.max(0, n - 1));

                // Async load chart data
                getChartData(
                  chartId,
                  autopilotConfig.connectionId,
                  spec.query,
                  undefined,
                  undefined,
                  false,
                  { xAxis: spec.x_axis ?? null, yAxis: spec.y_axis ?? null }
                ).then((dataResp) => {
                  if (dataResp.success && dataResp.data) {
                    setCharts((prev) =>
                      prev.map((c) =>
                        c.id === chartId ? { ...c, chartData: dataResp.data, isLoadingData: false } : c
                      )
                    );
                  } else {
                    setCharts((prev) =>
                      prev.map((c) => (c.id === chartId ? { ...c, isLoadingData: false } : c))
                    );
                  }
                }).catch(() => {
                  setCharts((prev) =>
                    prev.map((c) => (c.id === chartId ? { ...c, isLoadingData: false } : c))
                  );
                });
              } catch {
                // individual chart save failed — skip it, others continue
              }
            }

            // Done processing this batch of specs
            isGeneratingAutopilotRef.current = false;
            setIsGeneratingAutopilot(false);
            setAutopilotSkeletonCount(0);
            if (completedChartCount > 0) {
              toast.success(`Generated ${completedChartCount} chart${completedChartCount !== 1 ? "s" : ""} for your dashboard!`);

              // .pbit flow: derive a meaningful dashboard name from chart titles
              if (autopilotConfig.isPbitGenerated && _projectId) {
                const titles = chartSpecs
                  .filter((s) => !!s.title)
                  .map((s) => s.title);
                const derivedName = deriveNameFromChartTitles(titles);
                updateDashboard(_projectId, dashboardId, { title: derivedName })
                  .then((resp) => {
                    if (resp.success) {
                      setLocalDashboardName(derivedName);
                      onDashboardUpdated?.(dashboardId, { name: derivedName });
                    }
                  })
                  .catch(() => {
                    // Non-critical — dashboard still works without rename
                  });
              }
            } else {
              setAutopilotError("Charts were generated but could not be saved. Please try again.");
            }
            ws.disconnect();
          }
        });

        ws.chartCreation({
          nlq_query: "",
          data_connection_id: autopilotConfig.connectionId,
          db_schema: autopilotConfig.dbSchema,
          db_type: autopilotConfig.dbType as any,
          role: "Analyst",
          kpi_goals: autopilotConfig.kpiGoals,
          num_charts: NUM_CHARTS,
        });

        // Safety timeout — if no response in 3 minutes, abort
        setTimeout(() => {
          if (isGeneratingAutopilotRef.current) {
            isGeneratingAutopilotRef.current = false;
            setIsGeneratingAutopilot(false);
            setAutopilotSkeletonCount(0);
            ws.disconnect();
          }
        }, 180_000);
      } catch (err: any) {
        setAutopilotError(err.message || "Failed to connect for chart generation.");
        isGeneratingAutopilotRef.current = false;
        setIsGeneratingAutopilot(false);
        setAutopilotSkeletonCount(0);
      }
    };

    startGeneration();

    return () => {
      if (autopilotWsRef.current) {
        autopilotWsRef.current.disconnect();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilotConfig?.dashboardId]);

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
      return {
        ...getDefaultChartDataConfig(),
        effectiveType: chart.type,
        axisConfig: undefined,
      };
    }

    if (isExtendedChartType(chart.type)) {
      const ext = inferExtendedChartConfig(chart.chartData.data, chart.type, {
        xAxisKey: chart.chartData?.metadata?.xAxis ?? chart.xAxis ?? undefined,
        yAxisKey: chart.chartData?.metadata?.yAxis ?? chart.yAxis ?? undefined,
      });
      const config = extendedToChartDataConfig(ext);
      return {
        data: config.data,
        dataKeys: config.dataKeys,
        xAxisKey: config.xAxisKey,
        axisConfig: ext.axisConfig,
        effectiveType: ext.fallbackType ?? chart.type,
      };
    }

    // Legacy standard charts
    const inferredConfig = inferChartDataConfig(chart.chartData.data, chart.type as any, {
      xAxisHint: chart.chartData?.metadata?.xAxis ?? chart.xAxis ?? null,
      yAxisHint: chart.chartData?.metadata?.yAxis ?? chart.yAxis ?? null,
    });

    const metadataYAxis = chart.chartData?.metadata?.yAxis;
    const metadataXAxis = chart.chartData?.metadata?.xAxis;

    return {
      data: inferredConfig.data,
      dataKeys: {
        primary: metadataYAxis || chart.yAxis || inferredConfig.dataKeys.primary,
        secondary: inferredConfig.dataKeys.secondary,
      },
      xAxisKey: metadataXAxis || chart.xAxis || inferredConfig.xAxisKey,
      axisConfig: undefined,
      effectiveType: chart.type,
    };
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
              <h2 className="text-2xl text-foreground mb-1">{localDashboardName}</h2>
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
            {/* Allowed Domains */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="w-3.5 h-3.5" />
                Domains:
              </span>
              <AllowedDomainsSection
                dashboardId={dashboardId}
                onDomainsChanged={setAllowedDomainsCount}
              />
            </div>

            <div className="w-px h-6 bg-border" />

            <div className="relative group">
              <Button
                id="create-shareable-link-btn"
                variant="outline"
                onClick={() => {
                  if (allowedDomainsCount === 0) return;
                  setShareLinkModalOpen(true);
                  console.log(`[EMBED][STEP 6] Shareable link requested — dashboard ${dashboardId}, allowed domains: ${allowedDomainsCount}`);
                }}
                className="border-border"
                disabled={allowedDomainsCount === 0}
              >
                <Link2 className="w-4 h-4 mr-2" />
                Create shareable link
              </Button>
              {allowedDomainsCount === 0 && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover border border-border rounded-md shadow-lg text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                  Add at least one allowed domain first
                </div>
              )}
            </div>
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

        {/* Autopilot generation banner */}
        {isGeneratingAutopilot && (
          <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5">
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            <p className="text-sm text-primary font-medium">
              Autopilot is generating your charts based on your KPI goals...
            </p>
          </div>
        )}
        {autopilotError && (
          <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{autopilotError}</p>
            <button
              className="text-xs font-medium text-destructive underline underline-offset-2 hover:no-underline"
              onClick={() => {
                setAutopilotError(null);
                autopilotConsumedRef.current = false;
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI Infographics Row — shown for ALL dashboards */}
        <KpiInfographicsRow
          descriptors={kpiDescriptors}
          values={kpiValues}
          errors={kpiErrors}
          isLoading={kpiLoading}
          generationError={kpiGenerationError}
          onRefresh={() => {
            kpiGeneratedRef.current = false;
            runKpiQueries(kpiDescriptors);
          }}
        />

        {/* Charts Grid */}
        {isLoadingCharts ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading dashboard charts...</span>
          </div>
        ) : charts.length === 0 && autopilotSkeletonCount === 0 ? (
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
            {/* Real chart cards */}
            {charts.map((chart) => {
              const chartConfig = getChartDisplayConfig(chart);
              const numericId = parseInt(chart.id.replace(/-/g, '').substring(0, 8), 16) || 0;
              const isChartPinned = isPinned(numericId);
              const hasProbeSupport = !!(
                autopilotConnectionInfo?.dbSchema ||
                autopilotConnectionInfo?.dbType
              );

              return (
                <Card key={chart.id} className="p-6 border border-border relative group">
                  {/* Chart Actions */}
                  <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {/* Probe Mode */}
                    {hasProbeSupport && (
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                        onClick={() => setProbeChart(chart)}
                        title="Probe Mode — Refine this chart with AI"
                      >
                        <Telescope className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="icon"
                      className={`h-8 w-8 border-border ${isChartPinned
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
                      type={chartConfig.effectiveType}
                      data={chartConfig.data}
                      dataKeys={[
                        chartConfig.dataKeys.primary,
                        ...(chartConfig.dataKeys.secondary
                          ? [chartConfig.dataKeys.secondary]
                          : []),
                      ]}
                      xAxisKey={chartConfig.xAxisKey}
                      axisConfig={chartConfig.axisConfig}
                      height={300}
                      showLegend={!!chartConfig.dataKeys.secondary && chartConfig.effectiveType !== 'pie'}
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

            {/* Skeleton placeholders while Autopilot is generating */}
            {Array.from({ length: autopilotSkeletonCount }).map((_, i) => (
              <Card key={`skeleton-${i}`} className="p-6 border border-border">
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-5 w-48" />
                </div>
                <Skeleton className="h-3 w-64 mb-6" />
                <Skeleton className="h-[280px] w-full rounded-lg" />
              </Card>
            ))}
          </div>
        )}

        {/* Probe Mode Dialog */}
        <ProbeModeDialog
          isOpen={!!probeChart}
          onClose={() => setProbeChart(null)}
          chart={
            probeChart
              ? {
                  name: probeChart.title,
                  type: probeChart.type,
                  query: probeChart.query,
                  dataConnectionId: probeChart.databaseConnectionId,
                  databaseId: probeChart.databaseConnectionId,
                  db_schema: autopilotConnectionInfo?.dbSchema || "",
                  db_type: autopilotConnectionInfo?.dbType || "postgres",
                }
              : null
          }
          dashboards={[{ id: dashboardId, name: localDashboardName }]}
          projectId={_projectId}
          onApplyChanges={(modifiedSql, modifiedSpec) => {
            if (!probeChart) return;
            // Replace the chart in the dashboard view with the refined version
            setCharts((prev) =>
              prev.map((c) => {
                if (c.id !== probeChart.id) return c;
                return {
                  ...c,
                  query: modifiedSql,
                  type: (modifiedSpec?.chart_type as ChartType) || c.type,
                  xAxis: modifiedSpec?.x_axis ?? c.xAxis,
                  yAxis: modifiedSpec?.y_axis ?? c.yAxis,
                  isLoadingData: true,
                };
              })
            );
            // Reload chart data for the updated query
            const updatedChart = {
              ...probeChart,
              query: modifiedSql,
              type: (modifiedSpec?.chart_type as ChartType) || probeChart.type,
              xAxis: modifiedSpec?.x_axis ?? probeChart.xAxis,
              yAxis: modifiedSpec?.y_axis ?? probeChart.yAxis,
            };
            fetchChartData(updatedChart);
            setProbeChart(null);
            toast.success("Chart updated with Probe Mode changes");
          }}
        />

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

        {/* Share Link Modal */}
        <ShareLinkModal
          open={shareLinkModalOpen}
          onOpenChange={setShareLinkModalOpen}
          dashboardId={dashboardId}
          dashboardName={localDashboardName}
        />
      </div>
    </div>
  );
}