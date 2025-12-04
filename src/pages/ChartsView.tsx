import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Sparkles, BarChart3, LineChart, PieChart, AreaChart, Pin, Trash2, Plus, Clock, Filter, Calendar as CalendarIcon, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { GradientButton } from "../components/shared/GradientButton";
import { StatusBadge } from "../components/shared/StatusBadge";
import { ActionButtonGroup } from "../components/shared/ActionButtonGroup";
import { SkeletonGrid } from "../components/shared/SkeletonCard";
import { usePinnedCharts } from "../context/PinnedChartsContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
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
import { ChartPreviewDialog } from "../components/features/charts/ChartPreviewDialog";
import { ChartCard } from "../components/features/charts/ChartCard";
import { toast } from "sonner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getCharts, createChart, addChartToDashboard, generateCharts, getDatabases, getDashboards, updateFavoriteChart, deleteChart, getUserDashboardCharts, getChartData, type Chart as ApiChart, type ChartData as ApiChartData } from "../services/api";

// Custom styles for date picker clear button to prevent text overlap
if (typeof document !== 'undefined') {
  const styleId = 'datepicker-custom-styles-charts';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .react-datepicker-wrapper {
        width: 100%;
      }
      .react-datepicker__input-container {
        width: 100%;
        position: relative;
      }
      .react-datepicker__input-container .react-datepicker__close-icon {
        display: none !important;
      }
      .react-datepicker__input-container .react-datepicker__close-icon::after {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}
import type { ChartDataConfig } from "../utils/chartData";
import { loadDatabaseMetadata, storeDatabaseMetadata, type DatabaseMetadataEntry } from "../utils/databaseMetadata";
import {
  LineChart as RechartsLine,
  Line,
  BarChart as RechartsBar,
  Bar,
  AreaChart as RechartsArea,
  Area,
  PieChart as RechartsPie,
  Pie,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

interface Chart {
  id: number | string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  dataSource: string;
  databaseId?: string;
  createdAt: string;
  lastUpdated: string;
  query?: string;
  status: 'draft' | 'published';
  dashboardId?: number | string;
  createdById?: number;
  projectId?: number | string;
  isGenerated?: boolean;
  isFavorite?: boolean;
  is_time_based?: boolean;
  dateRange?: {
    startDate: Date | null;
    endDate: Date | null;
  };
}

interface ChartSuggestion {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  description: string;
  query: string;
  reasoning: string;
  dashboards?: string[];
  dataSource?: string;
  data?: any[];
  dataKeys?: {
    primary: string;
    secondary?: string;
  };
  xAxisKey?: string;
  isLoadingData?: boolean;
  dataError?: string;
  databaseId?: string;
  dataConnectionId?: string;
}

interface Dashboard {
  id: number;
  name: string;
}

const initialCharts: Chart[] = [
  {
    id: 1,
    name: "Revenue Trend",
    type: "line",
    dataSource: "Sales Database",
    createdAt: "2025-10-15",
    lastUpdated: "2 hours ago",
    query: "SELECT date, SUM(amount) as revenue FROM sales GROUP BY date ORDER BY date",
    status: "published",
    dashboardId: 1
  },
  {
    id: 2,
    name: "Product Distribution",
    type: "pie",
    dataSource: "Inventory DB",
    createdAt: "2025-10-14",
    lastUpdated: "5 hours ago",
    query: "SELECT category, COUNT(*) as count FROM products GROUP BY category",
    status: "published",
    dashboardId: 1
  },
  {
    id: 3,
    name: "Monthly Sales",
    type: "bar",
    dataSource: "Sales Database",
    createdAt: "2025-10-13",
    lastUpdated: "1 day ago",
    query: "SELECT MONTH(date) as month, SUM(amount) as total FROM sales GROUP BY MONTH(date)",
    status: "draft"
  },
  {
    id: 4,
    name: "User Growth",
    type: "area",
    dataSource: "Analytics DB",
    createdAt: "2025-10-12",
    lastUpdated: "2 days ago",
    query: "SELECT date, COUNT(DISTINCT user_id) as users FROM events GROUP BY date",
    status: "published",
    dashboardId: 2
  },
  {
    id: 5,
    name: "Conversion Funnel",
    type: "area",
    dataSource: "Analytics DB",
    createdAt: "2025-10-10",
    lastUpdated: "3 days ago",
    query: "SELECT stage, COUNT(*) as count FROM funnel GROUP BY stage",
    status: "draft"
  },
  {
    id: 6,
    name: "Regional Sales",
    type: "bar",
    dataSource: "Sales Database",
    createdAt: "2025-10-08",
    lastUpdated: "5 days ago",
    query: "SELECT region, SUM(revenue) as total FROM sales GROUP BY region",
    status: "published",
    dashboardId: 2
  }
];

const mockDashboards: Dashboard[] = [
  { id: 1, name: "Revenue Overview" },
  { id: 2, name: "Customer Analytics" },
  { id: 3, name: "Sales Performance" },
  { id: 4, name: "Product Metrics" },
  { id: 5, name: "Marketing ROI" },
  { id: 6, name: "Operations Dashboard" }
];

const mockDatabases = [
  { id: 1, name: "Sales Database", type: "PostgreSQL" },
  { id: 2, name: "Analytics DB", type: "MySQL" },
  { id: 3, name: "Inventory DB", type: "PostgreSQL" },
  { id: 4, name: "Customer DB", type: "MySQL" }
];

const mapDatabaseMetadataToState = (entry: DatabaseMetadataEntry) => ({
  id: String(entry.id),
  name: entry.name,
  type: entry.type || "postgresql",
  schema: entry.schema ?? null,
});

const chartTypeIcons = {
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  area: AreaChart
};

const chartTypeColors = {
  line: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
  bar: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
  pie: "from-green-500/20 to-green-600/20 border-green-500/30",
  area: "from-orange-500/20 to-orange-600/20 border-orange-500/30"
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

interface ChartDataStatus {
  data?: any[];
  metadata?: ApiChartData['metadata'];
  loading: boolean;
  error?: string;
}

const getDefaultChartDataConfig = (): ChartDataConfig => ({
  data: [],
  dataKeys: { primary: 'value' },
  xAxisKey: 'label',
});

const inferChartDataConfig = (rawData: any[] | undefined, chartType: Chart['type']): ChartDataConfig => {
  if (!rawData || rawData.length === 0) {
    return getDefaultChartDataConfig();
  }

  const normalizedRows = rawData.map((row, index) => {
    if (row && typeof row === 'object' && !Array.isArray(row)) {
      return { ...row };
    }
    return {
      value: typeof row === 'number' ? row : Number(row) || 0,
      label: `Row ${index + 1}`,
    };
  });

  const sample = normalizedRows[0];
  const keys = Object.keys(sample);

  if (keys.length === 0) {
    return getDefaultChartDataConfig();
  }

  const numericKeys = keys.filter((key) => typeof sample[key] === 'number' || (!isNaN(Number(sample[key])) && sample[key] !== null && sample[key] !== undefined));
  
  // Identify string keys for potential categorical data
  const stringKeys = keys.filter(
    (key) => typeof sample[key] === "string" || typeof sample[key] === "object"
  );
  
  let primaryKey = numericKeys[0] || keys[1] || keys[0];
  let secondaryKey = numericKeys.find((key) => key !== primaryKey);

  let potentialXAxisKey = keys.find((key) => key !== primaryKey && typeof sample[key] !== 'number') || keys.find((key) => key !== primaryKey);

  if (!potentialXAxisKey) {
    potentialXAxisKey = 'index';
  }

  // Handle case where there are NO numeric columns at all (backend sends string data)
  // We'll aggregate by counting occurrences of each category for bar charts
  if (numericKeys.length === 0 && chartType === 'bar') {
    console.log('[ChartsView/inferChartDataConfig] No numeric columns found for bar chart, aggregating...');
    console.log('[ChartsView/inferChartDataConfig] String keys:', stringKeys);
    console.log('[ChartsView/inferChartDataConfig] Sample data:', sample);
    
    // Find the categorical column (usually "value" or last string column)
    const categoryKey = stringKeys.find(key => 
      key.toLowerCase().includes('value') || 
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('category') ||
      key.toLowerCase().includes('institute')
    ) || stringKeys[stringKeys.length - 1];
    
    console.log('[ChartsView/inferChartDataConfig] Category key selected:', categoryKey);
    
    if (categoryKey) {
      // Count occurrences of each category
      const counts = new Map<string, number>();
      normalizedRows.forEach(row => {
        const category = String(row[categoryKey] || 'Unknown');
        counts.set(category, (counts.get(category) || 0) + 1);
      });
      
      // Convert to chart data format
      const aggregatedData = Array.from(counts.entries()).map(([name, count]) => ({
        name,
        value: count
      }));
      
      console.log('[ChartsView/inferChartDataConfig] Aggregated data:', aggregatedData);
      
      return {
        data: aggregatedData,
        dataKeys: { primary: 'value' },
        xAxisKey: 'name',
      };
    }
  }

  const data = normalizedRows.map((row, index) => {
    const coercedRow: Record<string, any> = { ...row };
    if (!(potentialXAxisKey in coercedRow)) {
      coercedRow[potentialXAxisKey] = index + 1;
    }

    coercedRow[primaryKey] =
      typeof row[primaryKey] === 'number'
        ? row[primaryKey]
        : Number(row[primaryKey]) || 0;

    if (secondaryKey) {
      coercedRow[secondaryKey] =
        typeof row[secondaryKey] === 'number'
          ? row[secondaryKey]
          : Number(row[secondaryKey]) || 0;
    }

    return coercedRow;
  });

  if (chartType === 'pie') {
    const nameKey = potentialXAxisKey === 'index' ? 'label' : potentialXAxisKey;
    return {
      data: data.map((row, index) => ({
        name: row[nameKey] ?? row[potentialXAxisKey] ?? `Slice ${index + 1}`,
        value: row[primaryKey],
      })),
      dataKeys: { primary: 'value' },
      xAxisKey: 'name',
    };
  }

  // Sort data by x-axis key for line and area charts to ensure proper connections
  let sortedData = data;
  if (chartType === 'line' || chartType === 'area') {
    sortedData = [...data].sort((a, b) => {
      const aVal = a[potentialXAxisKey];
      const bVal = b[potentialXAxisKey];
      
      // Handle date strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return aDate - bDate;
        }
        // If not valid dates, do string comparison
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

  return {
    data: sortedData,
    dataKeys: {
      primary: primaryKey,
      ...(secondaryKey ? { secondary: secondaryKey } : {}),
    },
    xAxisKey: potentialXAxisKey,
  };
};

interface ChartsViewProps {
  currentUser?: { id: number; name: string; email: string };
  projectId?: number | string;
  onChartCreated?: (chart: Chart) => void;
  pendingChartFromAI?: {
    id?: string;
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number;
  } | null;
  onChartFromAIProcessed?: () => void;
  onOpenAIAssistant?: () => void;
  onEditChart?: (chart: { name: string; type: 'line' | 'bar' | 'pie' | 'area'; description?: string }) => void;
}

// Helper function to format time ago
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

// Helper to convert arbitrary chart identifiers (number/UUID/undefined) into a stable numeric hash.
const chartIdToNumber = (id: string | number | null | undefined): number => {
  if (typeof id === 'number' && !Number.isNaN(id)) {
    return id;
  }

  if (typeof id === 'string') {
    const trimmed = id.trim();
    if (!trimmed) {
      return 0;
    }

    const parsed = Number(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }

    return Array.from(trimmed).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  }

  return 0;
};

export function ChartsView({ currentUser, projectId, onChartCreated, pendingChartFromAI, onChartFromAIProcessed, onOpenAIAssistant, onEditChart }: ChartsViewProps) {
  const { isPinned, togglePin } = usePinnedCharts();
  const [charts, setCharts] = useState<Chart[]>([]);
  const [generatedCharts, setGeneratedCharts] = useState<Chart[]>([]);
  const [chartToDelete, setChartToDelete] = useState<Chart | null>(null);
  const [previewChart, setPreviewChart] = useState<ChartSuggestion | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDashboard, setFilterDashboard] = useState<string>("all");
  const [filterDatabase, setFilterDatabase] = useState<string>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadingCharts, setIsLoadingCharts] = useState(true);
  const [chartToAddToDashboard, setChartToAddToDashboard] = useState<Chart | null>(null);
  const [selectedDashboardForAdd, setSelectedDashboardForAdd] = useState("");
  const [isGeneratingCharts, setIsGeneratingCharts] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [databases, setDatabases] = useState<Array<{ id: string; name: string; type: string; schema?: string | null }>>([]);
  const [selectedDatabaseForGenerate, setSelectedDatabaseForGenerate] = useState("");
  const [dashboards, setDashboards] = useState<Array<{ id: string | number; name: string }>>([]);
  const [chartDataStatus, setChartDataStatus] = useState<Record<string, ChartDataStatus>>({});
  const [chartDateRanges, setChartDateRanges] = useState<Record<string, { startDate: Date | null; endDate: Date | null }>>({});
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);

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

  const fetchChartDataForChart = useCallback(async (chart: Chart, dateRangeOverride?: { startDate: Date | null; endDate: Date | null }) => {
    if (!chart.query || !chart.databaseId) {
      return;
    }

    const chartKey = String(chart.id);
    // Use override if provided, otherwise check state, then chart object
    const dateRange = dateRangeOverride || chartDateRanges[chartKey] || chart.dateRange;

    setChartDataStatus((prev) => ({
      ...prev,
      [chartKey]: {
        ...(prev[chartKey] ?? {}),
        loading: true,
        error: undefined,
      },
    }));

    try {
      // Only send dates if both start and end dates are selected
      const hasBothDates = !!(dateRange?.startDate && dateRange?.endDate);
      const fromDate = hasBothDates && dateRange?.startDate
        ? formatDateForAPI(dateRange.startDate)
        : undefined;
      const toDate = hasBothDates && dateRange?.endDate
        ? formatDateForAPI(dateRange.endDate)
        : undefined;

      const response = await getChartData(chartKey, chart.databaseId, chart.query, fromDate, toDate);

      if (response.success && response.data) {
        setChartDataStatus((prev) => ({
          ...prev,
          [chartKey]: {
            data: response.data?.data ?? [],
            metadata: response.data?.metadata,
            loading: false,
            error: undefined,
          },
        }));
      } else {
        setChartDataStatus((prev) => ({
          ...prev,
          [chartKey]: {
            data: [],
            metadata: undefined,
            loading: false,
            error: response.error?.message || "Failed to fetch chart data",
          },
        }));
      }
    } catch (error: any) {
      setChartDataStatus((prev) => ({
        ...prev,
        [chartKey]: {
          data: [],
            metadata: undefined,
          loading: false,
          error: error.message || "Failed to fetch chart data",
        },
      }));
    }
  }, [chartDateRanges]);

  // Use only real dashboards from API, no mock data fallback
  const resolvedDashboards = dashboards;

  const resolvedDatabases = databases.length > 0
    ? databases
    : mockDatabases.map((database) => ({
        id: String(database.id),
        name: database.name,
        type: database.type,
        schema: null,
      }));

  const databaseNameById = useMemo(() => {
    const map = new Map<string, string>();
    resolvedDatabases.forEach((database) => {
      map.set(String(database.id), database.name);
    });
    return map;
  }, [resolvedDatabases]);

  useEffect(() => {
    if (!databaseNameById || databaseNameById.size === 0) {
      return;
    }

    setCharts((prevCharts) => {
      let didUpdate = false;
      const nextCharts = prevCharts.map((chart) => {
        if (!chart.databaseId) {
          return chart;
        }
        const resolvedName = databaseNameById.get(String(chart.databaseId));
        if (!resolvedName || chart.dataSource === resolvedName) {
          return chart;
        }
        didUpdate = true;
        return { ...chart, dataSource: resolvedName };
      });
      return didUpdate ? nextCharts : prevCharts;
    });

    setGeneratedCharts((prevCharts) => {
      let didUpdate = false;
      const nextCharts = prevCharts.map((chart) => {
        if (!chart.databaseId) {
          return chart;
        }
        const resolvedName = databaseNameById.get(String(chart.databaseId));
        if (!resolvedName || chart.dataSource === resolvedName) {
          return chart;
        }
        didUpdate = true;
        return { ...chart, dataSource: resolvedName };
      });
      return didUpdate ? nextCharts : prevCharts;
    });
  }, [databaseNameById]);

  const getDatabaseLabel = useCallback(
    (chart: Chart) => {
      if (chart.databaseId) {
        const matched = databaseNameById.get(String(chart.databaseId));
        if (matched) {
          return matched;
        }
      }
      return chart.dataSource || "Unknown Database";
    },
    [databaseNameById]
  );

  const databaseFilterOptions = useMemo(() => {
    const entries = new Map<string, string>();

    resolvedDatabases.forEach((database) => {
      if (database.name) {
        entries.set(database.name.toLowerCase(), database.name);
      }
    });

    charts.forEach((chart) => {
      const label = getDatabaseLabel(chart);
      if (label) {
        entries.set(label.toLowerCase(), label);
      }
    });

    return Array.from(entries.entries()).sort(([, labelA], [, labelB]) =>
      labelA.localeCompare(labelB)
    );
  }, [charts, getDatabaseLabel, resolvedDatabases]);

  const statusFilterOptions = useMemo(() => {
    const statuses = new Set<string>();
    charts.forEach((chart) => {
      if (chart.status) {
        statuses.add(chart.status);
      }
    });
    generatedCharts.forEach((chart) => {
      if (chart.status) {
        statuses.add(chart.status);
      }
    });

    if (statuses.size === 0) {
      statuses.add("published");
      statuses.add("draft");
    }

    return Array.from(statuses);
  }, [charts, generatedCharts]);

  // Fetch charts when projectId is available
  useEffect(() => {
    if (!projectId) {
      setIsLoadingCharts(false);
      return;
    }

    const cachedDatabases = loadDatabaseMetadata(String(projectId));
    if (cachedDatabases && cachedDatabases.length > 0) {
      setDatabases(cachedDatabases.map(mapDatabaseMetadataToState));
    }

    fetchCharts();
    fetchDatabases();
    fetchDashboards();
  }, [projectId]);

  useEffect(() => {
    if (!charts.length) {
      return;
    }

    charts.forEach((chart) => {
      const chartKey = String(chart.id);
      if (!chart.query || !chart.databaseId) {
        return;
      }

      const status = chartDataStatus[chartKey];
      if (!status || (!status.data && !status.loading && !status.error)) {
        fetchChartDataForChart(chart);
      }
    });
  }, [charts, chartDataStatus, fetchChartDataForChart]);

  const fetchDatabases = async () => {
    if (!projectId) return;
    
    try {
      const response = await getDatabases(String(projectId));
      if (response.success && response.data) {
        const metadataEntries: DatabaseMetadataEntry[] = response.data.map((db) => ({
          id: db.id,
          name: db.name,
          type: db.type,
          schema: db.schema ?? null,
        }));

        setDatabases(metadataEntries.map(mapDatabaseMetadataToState));
        storeDatabaseMetadata(String(projectId), metadataEntries);
      }
    } catch (err: any) {
      // Silently fail - databases not critical for charts view
      console.error("Failed to fetch databases:", err);
    }
  };

  const fetchDashboards = async () => {
    if (!projectId) return;
    
    try {
      const response = await getDashboards(String(projectId));
      if (response.success && response.data) {
        setDashboards(response.data.map(dashboard => ({
          id: dashboard.id,
          name: dashboard.name,
        })));
      }
    } catch (err: any) {
      // Silently fail - dashboards not critical for charts view
      console.error("Failed to fetch dashboards:", err);
    }
  };

  const fetchCharts = async () => {
    if (!projectId) return;
    
    setIsLoadingCharts(true);
    try {
      const [chartsResponse, dashboardChartsResponse] = await Promise.all([
        getCharts(String(projectId)),
        getUserDashboardCharts(),
      ]);

      let projectCharts: Chart[] = [];
      if (chartsResponse.success && chartsResponse.data) {
        projectCharts = chartsResponse.data.map((chart) => ({
          id: chart.id,
          name: chart.name,
          type: chart.type,
          dataSource: chart.databaseId ? `Database ${chart.databaseId}` : "Unknown Database",
          databaseId: chart.databaseId,
          createdAt: chart.createdAt,
          lastUpdated: formatTimeAgo(chart.updatedAt || chart.createdAt),
          query: chart.query,
          status: 'published' as const,
          createdById: currentUser?.id,
          projectId: chart.projectId || projectId,
          isGenerated: false,
          isFavorite: (chart as any).isFavorite || false,
          is_time_based: chart.is_time_based ?? false,
        }));
      } else {
        toast.error(chartsResponse.error?.message || "Failed to load charts");
      }

      let dashboardCharts: Chart[] = [];
      if (dashboardChartsResponse.success && dashboardChartsResponse.data) {
        dashboardCharts = dashboardChartsResponse.data
          .filter((dashboard) => !projectId || String(dashboard.projectId) === String(projectId))
          .flatMap((dashboard) =>
            dashboard.charts.map((chart) => {
              const createdAt = chart.created_at || new Date().toISOString();
              const status = chart.status?.toString().toLowerCase() === 'draft' ? 'draft' as const : 'published' as const;
              const chartTypeSource = chart.chart_type || chart.type;

              return {
                id: chart.id,
                name: chart.title || "Untitled Chart",
                type: mapChartType(chartTypeSource),
                dataSource: chart.database_connection_id ? `Database ${chart.database_connection_id}` : "Unknown Database",
                databaseId: chart.database_connection_id || undefined,
                createdAt,
                lastUpdated: formatTimeAgo(createdAt),
                query: (chart as any).query || undefined,
                status,
                dashboardId: dashboard.dashboardId,
                createdById: currentUser?.id,
                projectId: dashboard.projectId || projectId,
                isGenerated: false,
                isFavorite: false,
                is_time_based: (chart as any).is_time_based ?? false,
              };
            })
          );
      } else if (!dashboardChartsResponse.success) {
        toast.error(dashboardChartsResponse.error?.message || "Failed to load dashboard charts");
      }

      const combinedChartsMap = new Map<string, Chart>();
      const addChartToMap = (chart: Chart) => {
        const key = String(chart.id);
        if (combinedChartsMap.has(key)) {
          const existing = combinedChartsMap.get(key)!;
          combinedChartsMap.set(key, {
            ...existing,
            ...chart,
            dashboardId: chart.dashboardId ?? existing.dashboardId,
            lastUpdated: chart.lastUpdated || existing.lastUpdated,
            status: chart.status || existing.status,
            dataSource: chart.dataSource || existing.dataSource,
            query: chart.query ?? existing.query,
            isGenerated: chart.isGenerated ?? existing.isGenerated,
            isFavorite: chart.isFavorite ?? existing.isFavorite,
            is_time_based: chart.is_time_based ?? existing.is_time_based ?? false,
          });
        } else {
          combinedChartsMap.set(key, chart);
        }
      };

      projectCharts.forEach(addChartToMap);
      dashboardCharts.forEach(addChartToMap);

      setCharts(Array.from(combinedChartsMap.values()));
    } catch (err: any) {
      toast.error(err.message || "An error occurred while fetching charts");
      setCharts([]);
    } finally {
      setIsLoadingCharts(false);
    }
  };

  // Handle pending chart from AI Assistant - create via API
  useEffect(() => {
    if (!pendingChartFromAI || !projectId) {
      return;
    }

    // If chart already has an ID, it was already created (e.g., from ChartPreviewDialog)
    // Just refresh the charts list instead of creating again
    const hasId = pendingChartFromAI.id && (typeof pendingChartFromAI.id === 'string' ? pendingChartFromAI.id.trim() !== '' : true);
    if (hasId) {
      fetchCharts()
        .catch((err) => {
          console.error("Failed to refresh charts after AI draft save:", err);
          toast.error(err?.message || "Failed to refresh charts");
        })
        .finally(() => {
          onChartFromAIProcessed?.();
        });
      return;
    }

    // Only create if chart doesn't have an ID yet
    handleCreateChartFromAI(pendingChartFromAI);
  }, [pendingChartFromAI, projectId]);

  const handleCreateChartFromAI = async (chartData: {
    id?: string;
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number;
  }) => {
    if (!projectId) {
      toast.error("Project ID is required to create a chart");
      return;
    }

    // Prevent duplicate creation if chart already has an ID
    const hasId = chartData.id && (typeof chartData.id === 'string' ? chartData.id.trim() !== '' : true);
    if (hasId) {
      console.log('Chart already has ID, skipping creation:', chartData.id);
      onChartFromAIProcessed?.();
      return;
    }

    try {
      // Extract database ID from dataSource if it's in format "Database {id}"
      // Support both UUID format and numeric IDs
      let databaseId: string | undefined;
      const dbIdMatch = chartData.dataSource.match(/Database ([^\s]+)/);
      if (dbIdMatch) {
        databaseId = dbIdMatch[1];
      } else {
        // If not in "Database {id}" format, check if dataSource is the ID directly
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (chartData.dataSource && uuidRegex.test(chartData.dataSource)) {
          databaseId = chartData.dataSource;
        }
      }

      if (!databaseId) {
        toast.error("Database connection ID is required. Please select a database when creating the chart.");
        return;
      }

      const response = await createChart(String(projectId), {
        name: chartData.name,
        type: chartData.type,
        query: chartData.query,
        databaseId: databaseId,
        config: {},
      });

      if (response.success && response.data) {
        // Map API chart to UI format
        const newChart: Chart = {
          id: response.data.id,
          name: response.data.name,
          type: response.data.type,
          dataSource: chartData.dataSource,
          databaseId: databaseId,
          createdAt: response.data.createdAt,
          lastUpdated: "just now",
          query: response.data.query,
          status: chartData.status,
          dashboardId: chartData.dashboardId,
          createdById: currentUser?.id,
          projectId: response.data.projectId || projectId,
          isGenerated: true,
        };

        setCharts(prev => [newChart, ...prev]);
        onChartCreated?.(newChart);
        
        if (chartData.status === 'draft') {
          toast.success(`Chart "${chartData.name}" saved as draft!`);
        } else {
          toast.success(`Chart "${chartData.name}" added to dashboard!`);
        }
        
        onChartFromAIProcessed?.();
      } else {
        toast.error(response.error?.message || "Failed to create chart");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while creating chart");
    }
  };

  const handleDeleteChart = async () => {
    if (!chartToDelete) return;
    
    try {
      const chartId = typeof chartToDelete.id === 'string' ? chartToDelete.id : String(chartToDelete.id);
      const response = await deleteChart(chartId, chartToDelete.dashboardId);
      
      if (response.success) {
        setCharts(charts.filter(c => c.id !== chartToDelete.id));
        setGeneratedCharts(generatedCharts.filter(c => c.id !== chartToDelete.id));
        setChartDataStatus((prev) => {
          const updated = { ...prev };
          delete updated[String(chartToDelete.id)];
          return updated;
        });
        toast.success(`Chart "${chartToDelete.name}" deleted successfully!`);
        setChartToDelete(null);
      } else {
        toast.error(response.error?.message || "Failed to delete chart");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while deleting chart");
    }
  };

  const handleTogglePin = async (chart: Chart) => {
    // Ensure chart.id is a string (UUID) for API call
    const chartId = typeof chart.id === 'string' ? chart.id : String(chart.id);
    const dataSourceLabel = getDatabaseLabel(chart);
    
    try {
      const response = await updateFavoriteChart(chartId);
      if (response.success && response.data) {
        const newFavoriteStatus = response.data.is_favorite;
        
        // Update local chart state
        const updateChartFavorite = (prevCharts: Chart[]) => 
          prevCharts.map(c => c.id === chart.id ? { ...c, isFavorite: newFavoriteStatus } : c);
        
        setCharts(updateChartFavorite);
        setGeneratedCharts(updateChartFavorite);
        
        // Also update context for UI consistency
        const dashboard = resolvedDashboards.find((d) => String(d.id) === String(chart.dashboardId));
        const numericId = chartIdToNumber(chart.id);
        const pinnedChartData = {
          id: numericId,
          name: chart.name,
          description: `${chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} chart from ${dataSourceLabel}`,
          lastUpdated: chart.lastUpdated,
          chartType: chart.type,
          category: chart.type.charAt(0).toUpperCase() + chart.type.slice(1),
          dashboardName: dashboard?.name || 'No Dashboard',
          dataSource: dataSourceLabel
        };
        
        // Update context based on new favorite status
        if (newFavoriteStatus && !isPinned(numericId)) {
          // Pin if not already pinned in context
          togglePin(pinnedChartData);
        } else if (!newFavoriteStatus && isPinned(numericId)) {
          // Unpin if currently pinned in context
          togglePin(pinnedChartData);
        }
        
        toast.success(newFavoriteStatus 
          ? `"${chart.name}" pinned to Home Dashboard`
          : `"${chart.name}" unpinned from Home Dashboard`);
      } else {
        toast.error(response.error?.message || "Failed to update favorite status");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while updating favorite status");
    }
  };

  const handleOpenChartPreview = async (chart: Chart) => {
    // Use cached dashboards - don't refetch every time
    // Dashboards are already fetched on mount and after adding to dashboard
    
    const chartKey = String(chart.id);
    const status = chartDataStatus[chartKey];
    const dataSourceLabel = getDatabaseLabel(chart);

    if ((!status || (!status.data && !status.loading && !status.error)) && chart.query && chart.databaseId) {
      fetchChartDataForChart(chart);
    }

    const preparedData = status?.data ? inferChartDataConfig(status.data, chart.type) : undefined;

    // Find which dashboards this chart belongs to - use current dashboards state
    const chartDashboards = chart.dashboardId 
      ? [dashboards.find((d) => String(d.id) === String(chart.dashboardId))?.name].filter(Boolean) as string[]
      : [];
    
    const chartAsSuggestion: ChartSuggestion & { dataSource?: string } = {
      id: `existing-${chart.id}`,
      name: chart.name,
      type: chart.type,
      description: `${chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} chart from ${dataSourceLabel}`,
      query: chart.query || "",
      reasoning: `This is an existing chart from your ${dataSourceLabel} database.`,
      dashboards: chartDashboards,
      dataSource: dataSourceLabel,
      data: preparedData?.data,
      dataKeys: preparedData?.dataKeys,
      xAxisKey: preparedData?.xAxisKey,
      isLoadingData: status ? status.loading : Boolean(chart.query && chart.databaseId),
      dataError: status?.error,
      databaseId: chart.databaseId ? String(chart.databaseId) : undefined,
      dataConnectionId: chart.databaseId ? String(chart.databaseId) : undefined,
    };
    setPreviewChart(chartAsSuggestion);
  };

  useEffect(() => {
    if (!previewChart || !previewChart.databaseId || databaseNameById.size === 0) {
      return;
    }

    const resolvedName = databaseNameById.get(String(previewChart.databaseId));
    if (!resolvedName || previewChart.dataSource === resolvedName) {
      return;
    }

    setPreviewChart((current) => {
      if (!current || !current.databaseId) {
        return current;
      }

      const sameDatabase = String(current.databaseId) === String(previewChart.databaseId);
      if (!sameDatabase) {
        return current;
      }

      const updatedDescription = `${current.type.charAt(0).toUpperCase() + current.type.slice(1)} chart from ${resolvedName}`;
      const shouldUpdateReasoning = current.id?.startsWith('existing-') && current.reasoning?.includes('existing chart');

      return {
        ...current,
        dataSource: resolvedName,
        description: updatedDescription,
        reasoning: shouldUpdateReasoning
          ? `This is an existing chart from your ${resolvedName} database.`
          : current.reasoning,
      };
    });
  }, [databaseNameById, previewChart, setPreviewChart]);

  const handleGenerateCharts = () => {
    // Always open AI Assistant instead of showing dialog
    // This provides a better user experience for chart generation
    if (onOpenAIAssistant) {
      onOpenAIAssistant();
    } else {
      // Fallback: If AI Assistant is not available, show dialog only if databases exist
      if (databases.length > 0) {
        setShowGenerateDialog(true);
        if (databases.length === 1) {
          setSelectedDatabaseForGenerate(databases[0].id);
        }
      } else {
        toast.error("No databases available. Please add a database connection first.");
      }
    }
  };

  const handleConfirmGenerateCharts = async () => {
    if (!projectId || !selectedDatabaseForGenerate) {
      toast.error("Please select a database");
      return;
    }

    setIsGeneratingCharts(true);
    try {
      const selectedDb = databases.find(db => db.id === selectedDatabaseForGenerate);
      const response = await generateCharts(String(projectId), selectedDatabaseForGenerate, {
        db_type: selectedDb?.type || 'postgresql',
        role: 'admin',
      });

      if (response.success && response.data) {
        // Map generated charts to UI format
        const newCharts: Chart[] = response.data.generated_charts.map((chart) => ({
          id: chart.id,
          name: chart.title,
          type: mapChartType(chart.chart_type) as 'line' | 'bar' | 'pie' | 'area',
          dataSource: selectedDb?.name || "Unknown Database",
          databaseId: selectedDatabaseForGenerate,
          createdAt: new Date().toISOString(),
          lastUpdated: "just now",
          query: chart.query,
          status: 'draft' as const,
          createdById: currentUser?.id,
          projectId: projectId,
          isGenerated: true,
          is_time_based: chart.is_time_based ?? false,
        }));

        setGeneratedCharts(prev => [...newCharts, ...prev]);
        setCharts(prev => [...newCharts, ...prev]);
        toast.success(`Generated ${newCharts.length} chart(s) successfully!`);
        setShowGenerateDialog(false);
        setSelectedDatabaseForGenerate("");
      } else {
        toast.error(response.error?.message || "Failed to generate charts");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while generating charts");
    } finally {
      setIsGeneratingCharts(false);
    }
  };

  // Helper to map chart type
  const mapChartType = (type: string | undefined | null): 'line' | 'bar' | 'pie' | 'area' => {
    if (!type) {
      return 'line';
    }
    const normalized = type.toLowerCase();
    const typeMap: Record<string, 'line' | 'bar' | 'pie' | 'area'> = {
      line: 'line',
      bar: 'bar',
      pie: 'pie',
      area: 'area',
    };
    return typeMap[normalized] || 'line';
  };



  const handleAddToDashboard = async (chart: Chart) => {
    if (!selectedDashboardForAdd) {
      toast.error("Please select a dashboard");
      return;
    }

    if (!projectId) {
      toast.error("Project ID is required");
      return;
    }

    // Prefer the explicit databaseId field when available
    let databaseId: string | undefined = chart.databaseId
      ? String(chart.databaseId)
      : undefined;

    // Fallback: infer from dataSource legacy formats
    if (!databaseId && chart.dataSource) {
      const dbIdMatch = chart.dataSource.match(/Database ([^\s]+)/);
      if (dbIdMatch) {
        databaseId = dbIdMatch[1];
      } else {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(chart.dataSource)) {
          databaseId = chart.dataSource;
        }
      }
    }

    if (!databaseId) {
      toast.error("Database connection ID is required to add chart to dashboard");
      return;
    }

    try {
      const response = await addChartToDashboard({
        title: chart.name,
        query: chart.query || '',
        chart_type: chart.type,
        dashboard_id: selectedDashboardForAdd,
        data_connection_id: databaseId,
        type: chart.type,
      });

      if (response.success) {
        // Update local state
        const dashboardId = parseInt(selectedDashboardForAdd);
        const updatedChart = { ...chart, dashboardId, status: 'published' as const };
        
        // Update in generated charts if it exists there
        if (generatedCharts.find(c => c.id === chart.id)) {
          setGeneratedCharts(prev => prev.map(c => c.id === chart.id ? updatedChart : c));
        }
        
        // Update in all charts if it exists there
        if (charts.find(c => c.id === chart.id)) {
          setCharts(prev => prev.map(c => c.id === chart.id ? updatedChart : c));
        } else {
          // If not in charts, add it
          setCharts(prev => [updatedChart, ...prev]);
        }

        const dashboard = resolvedDashboards.find(d => String(d.id) === selectedDashboardForAdd);
        toast.success(`"${chart.name}" added to ${dashboard?.name || 'dashboard'}`);
        setChartToAddToDashboard(null);
        setSelectedDashboardForAdd("");
        // Refresh dashboards to get updated chart counts
        fetchDashboards();
      } else {
        toast.error(response.error?.message || "Failed to add chart to dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while adding chart to dashboard");
    }
  };

  // Filter charts
  const filteredCharts = charts.filter(chart => {
    const name = chart.name ? chart.name.toLowerCase() : '';
    const databaseLabel = getDatabaseLabel(chart);
    const dataSource = databaseLabel.toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch = name.includes(query) || dataSource.includes(query);
    const matchesStatus = filterStatus === "all" || chart.status === filterStatus;
    const matchesDashboard = filterDashboard === "all" || 
                           (filterDashboard === "unassigned" && !chart.dashboardId) ||
                           (chart.dashboardId && chart.dashboardId.toString() === filterDashboard);
    const matchesDatabase = filterDatabase === "all" || dataSource === filterDatabase;
    
    return matchesSearch && matchesStatus && matchesDashboard && matchesDatabase;
  });

  const renderChartPreview = (chart: Chart) => {
    const chartKey = String(chart.id);
    const status = chartDataStatus[chartKey];
    const hasQueryAndConnection = Boolean(chart.query && chart.databaseId);
    const preparedData = status?.data ? inferChartDataConfig(status.data, chart.type) : getDefaultChartDataConfig();
    const isLoading = status ? status.loading : hasQueryAndConnection;
    const error = status?.error;

    return (
      <div className="relative h-[280px] bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg overflow-hidden p-4 flex items-center justify-center">
        {isLoading && hasQueryAndConnection && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-md rounded-lg z-10">
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
          <div className="text-center text-muted-foreground text-xs">
            <p className="font-medium text-foreground mb-1">Unable to load data</p>
            <p className="max-w-[220px] mx-auto leading-relaxed">{error}</p>
          </div>
        )}

        {!isLoading && !error && !hasQueryAndConnection && (
          <div className="text-center text-muted-foreground text-xs">
            <p className="font-medium text-foreground mb-1">Missing query configuration</p>
            <p className="max-w-[220px] mx-auto leading-relaxed">
              This chart does not have a saved SQL query or database connection. Edit the chart to provide both before viewing live data.
            </p>
          </div>
        )}

        {!isLoading && !error && preparedData.data.length === 0 && hasQueryAndConnection && (
          <div className="text-center text-muted-foreground text-xs">
            <p className="font-medium text-foreground mb-1">No data returned</p>
            <p className="max-w-[220px] mx-auto leading-relaxed">
              This chart&apos;s query did not return any rows. Try adjusting the query or filters.
            </p>
          </div>
        )}

        {!isLoading && !error && preparedData.data.length > 0 && hasQueryAndConnection && (
          <ChartCard
            type={chart.type}
            data={preparedData.data}
            dataKeys={preparedData.dataKeys}
            xAxisKey={preparedData.xAxisKey}
            showLegend={!!preparedData.dataKeys.secondary && chart.type !== 'pie'}
            height={240}
          />
        )}
      </div>
    );
  };

  const renderDateRangeButton = (chart: Chart) => {
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
          startDate={chartDateRanges[String(chart.id)]?.startDate || chart.dateRange?.startDate || null}
          endDate={chartDateRanges[String(chart.id)]?.endDate || chart.dateRange?.endDate || null}
          onChange={(dates) => {
            const [start, end] = dates as [Date | null, Date | null];
            const chartKey = String(chart.id);
            setChartDateRanges(prev => ({
              ...prev,
              [chartKey]: { startDate: start, endDate: end }
            }));
            
            // Update chart object
            setCharts(prev => prev.map(c => 
              c.id === chart.id 
                ? { ...c, dateRange: { startDate: start, endDate: end } }
                : c
            ));
            
            // Fetch data if both dates are set or both are cleared
            // Use the updated date range directly to avoid state timing issues
            if ((start && end) || (!start && !end)) {
              const updatedChart = { ...chart, dateRange: { startDate: start, endDate: end } };
              // Pass the date range directly to ensure we use the latest values
              const dateRangeToUse = { startDate: start, endDate: end };
              fetchChartDataForChart(updatedChart, dateRangeToUse);
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
                  const range = chartDateRanges[String(chart.id)] || chart.dateRange;
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
              {(chartDateRanges[String(chart.id)]?.startDate || chart.dateRange?.startDate) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const chartKey = String(chart.id);
                    setChartDateRanges(prev => ({
                      ...prev,
                      [chartKey]: { startDate: null, endDate: null }
                    }));
                    setCharts(prev => prev.map(c => 
                      c.id === chart.id 
                        ? { ...c, dateRange: { startDate: null, endDate: null } }
                        : c
                    ));
                    const updatedChart = { ...chart, dateRange: { startDate: null, endDate: null } };
                    fetchChartDataForChart(updatedChart, { startDate: null, endDate: null });
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

  const renderChartCard = (chart: Chart, isGenerated: boolean = false) => {
    const Icon = chartTypeIcons[chart.type];
    const dashboard = resolvedDashboards.find((d) => String(d.id) === String(chart.dashboardId));
    const dataSourceLabel = getDatabaseLabel(chart);
    const colorClass = {
      line: 'text-[#06B6D4] bg-[#06B6D4]/10',
      bar: 'text-[#8B5CF6] bg-[#8B5CF6]/10',
      pie: 'text-[#10B981] bg-[#10B981]/10',
      area: 'text-[#F59E0B] bg-[#F59E0B]/10'
    }[chart.type];
    const chartName = chart.name?.trim() || "Untitled Chart";

    return (
      <Card
        key={chart.id}
        className="overflow-hidden border-2 border-border hover:border-primary/30 hover:shadow-xl transition-smooth cursor-pointer group hover-lift card-shadow relative"
        onClick={(e) => {
          // Don't open preview if clicking on date picker or its container
          const target = e.target as HTMLElement;
          if (
            target.closest('[data-date-picker="true"]') ||
            target.closest('.react-datepicker-wrapper') || 
            target.closest('.react-datepicker__input-container') ||
            target.closest('.react-datepicker') ||
            target.closest('.react-datepicker__portal')
          ) {
            e.stopPropagation();
            return;
          }
          if (!isGenerated) {
            handleOpenChartPreview(chart);
          }
        }}
      >
        {/* Compact Header - Overlaid on chart */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-card via-card/95 to-transparent pb-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass} transition-smooth group-hover:scale-110`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h3 className="text-foreground line-clamp-1 mb-1">
                      {chartName}
                    </h3>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="bg-card text-foreground border border-border shadow-lg whitespace-normal break-words max-w-xs"
                  >
                    {chartName}
                  </TooltipContent>
                </Tooltip>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="line-clamp-1">{dataSourceLabel}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{chart.lastUpdated}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {isGenerated && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    setChartToAddToDashboard(chart);
                  }}
                  className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              )}
              <ActionButtonGroup
                actions={[
                  // Edit functionality commented out
                  // {
                  //   icon: <Edit2 />,
                  //   onClick: (e) => {
                  //     e?.stopPropagation();
                  //     if (onEditChart) {
                  //       onEditChart({
                  //         name: chart.name,
                  //         type: chart.type,
                  //         description: chart.dataSource
                  //       });
                  //     }
                  //     if (onOpenAIAssistant) {
                  //       onOpenAIAssistant();
                  //     }
                  //   },
                  //   label: "Edit chart",
                  //   variant: "ghost"
                  // },
                  {
                    icon: <Trash2 />,
                    onClick: (e) => {
                      e?.stopPropagation();
                      setChartToDelete(chart);
                    },
                    label: "Delete chart",
                    variant: "ghost",
                    className: "hover:text-destructive"
                  },
                  {
                    icon: <Pin className={(chart.isFavorite || isPinned(chartIdToNumber(chart.id))) ? 'fill-primary/20 rotate-45' : ''} />,
                    onClick: (e) => {
                      e?.stopPropagation();
                      handleTogglePin(chart);
                    },
                    label: (chart.isFavorite || isPinned(chartIdToNumber(chart.id))) ? "Unpin chart" : "Pin chart",
                    variant: "ghost",
                    className: (chart.isFavorite || isPinned(chartIdToNumber(chart.id))) ? 'text-primary hover:text-primary/80 opacity-100' : 'hover:text-primary'
                  }
                ]}
              />
            </div>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="pt-24 px-2 pb-12 relative">
          {renderChartPreview(chart)}
        </div>

        {/* Bottom Section - Status Badge and Date Range */}
        <div className="px-4 pb-3 flex items-center justify-between gap-4" data-date-picker="true">
          {/* Status Badge */}
          <div>
            {chart.status === 'published' && dashboard && (
              <StatusBadge status="published" label={dashboard.name} />
            )}
            {chart.status === 'draft' && (
              <StatusBadge status="draft" />
            )}
          </div>
          
          {/* Date Range Picker */}
          {chart.is_time_based === true && (
            <div>
              {renderDateRangeButton(chart)}
            </div>
          )}
        </div>
      </Card>
    );
  };

  if (isLoadingCharts) {
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="max-w-[1600px] mx-auto p-10 space-y-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground">Charts</h1>
              <p className="text-muted-foreground mt-0.5">
                Generate and manage your data visualizations
              </p>
            </div>
            
            {/* Skeleton for controls */}
            <div className="w-full sm:w-[140px] h-9 bg-muted/50 rounded-md animate-pulse opacity-50" />
          </div>

          {/* Skeleton grid */}
          <SkeletonGrid count={6} variant="chart" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-[1600px] mx-auto p-10 space-y-10">
        {/* Header with Inline Generation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Charts</h1>
            <p className="text-muted-foreground mt-0.5">
              Generate and manage your data visualizations
            </p>
          </div>
          
          {/* Compact Generation Controls */}
          <GradientButton
            onClick={handleGenerateCharts}
            size="sm"
            className="h-9"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate Charts
          </GradientButton>
        </div>

        {/* Generated Charts Section */}
        {generatedCharts.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-foreground">Recently Generated</h2>
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                {generatedCharts.length} charts
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {generatedCharts.map((chart) => renderChartCard(chart, true))}
            </div>
          </div>
        )}

        {/* All Charts Section */}
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-foreground">All Charts</h2>

            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1 sm:flex-initial sm:w-[280px]">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search charts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 border-border text-sm"
                />
              </div>
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={`h-9 w-9 border-border ${
                      (filterDashboard !== 'all' || filterDatabase !== 'all' || filterStatus !== 'all')
                        ? 'border-primary text-primary'
                        : ''
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 border-border" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm text-foreground">Filters</h3>
                      {(filterDashboard !== 'all' || filterDatabase !== 'all' || filterStatus !== 'all') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFilterDashboard('all');
                            setFilterDatabase('all');
                            setFilterStatus('all');
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Clear all
                        </Button>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Dashboard</label>
                        <Select value={filterDashboard} onValueChange={setFilterDashboard}>
                          <SelectTrigger className="h-9 border-border">
                            <SelectValue placeholder="All Dashboards" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Dashboards</SelectItem>
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {resolvedDashboards.map((dashboard) => (
                              <SelectItem key={dashboard.id} value={dashboard.id.toString()}>
                                {dashboard.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Database</label>
                        <Select value={filterDatabase} onValueChange={setFilterDatabase}>
                          <SelectTrigger className="h-9 border-border">
                            <SelectValue placeholder="All Databases" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Databases</SelectItem>
                            {databaseFilterOptions.map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                          <SelectTrigger className="h-9 border-border">
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            {statusFilterOptions.map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Charts Grid */}
          {filteredCharts.length === 0 ? (
            <Card className="border-border p-12">
              <div className="flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-foreground mb-2">No charts found</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || filterStatus !== "all"
                      ? "Try adjusting your filters"
                      : "Generate your first chart using AI"}
                  </p>
                </div>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCharts.map((chart) => renderChartCard(chart, false))}
            </div>
          )}
        </div>

        {/* Add to Dashboard Dialog */}
        <Dialog open={!!chartToAddToDashboard} onOpenChange={() => setChartToAddToDashboard(null)}>
          <DialogContent className="border-border">
            <DialogHeader>
              <DialogTitle>Add to Dashboard</DialogTitle>
              <DialogDescription>
                Select a dashboard to add "{chartToAddToDashboard?.name}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={selectedDashboardForAdd} onValueChange={setSelectedDashboardForAdd}>
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {resolvedDashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={String(dashboard.id)}>
                      {dashboard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setChartToAddToDashboard(null);
                    setSelectedDashboardForAdd("");
                  }}
                  className="border-border"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => chartToAddToDashboard && handleAddToDashboard(chartToAddToDashboard)}
                  disabled={!selectedDashboardForAdd}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add to Dashboard
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Chart Preview Dialog */}
        {previewChart && (
          <ChartPreviewDialog
            chart={previewChart}
            isOpen={!!previewChart}
            onClose={() => setPreviewChart(null)}
            dashboards={dashboards}
            projectId={projectId}
            onAddToDashboard={(dashboardId) => {
              // Refresh charts after adding to dashboard
              if (projectId) {
                fetchCharts();
                fetchDashboards(); // Refresh dashboards too
              }
              setPreviewChart(null);
            }}
            onSaveAsDraft={() => {
              if (projectId) {
                fetchCharts();
              }
            }}
            isExistingChart={previewChart.id.startsWith('existing-')}
            chartStatus="published"
          />
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!chartToDelete} onOpenChange={() => setChartToDelete(null)}>
          <AlertDialogContent className="border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Chart</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{chartToDelete?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteChart}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Generate Charts Dialog */}
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="border-border">
            <DialogHeader>
              <DialogTitle>Generate Charts</DialogTitle>
              <DialogDescription>
                Select a database to automatically generate charts based on its schema.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Select value={selectedDatabaseForGenerate} onValueChange={setSelectedDatabaseForGenerate}>
                <SelectTrigger className="border-border">
                  <SelectValue placeholder="Select a database" />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((database) => (
                    <SelectItem key={database.id} value={database.id}>
                      {database.name} ({database.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowGenerateDialog(false);
                    setSelectedDatabaseForGenerate("");
                  }}
                  className="border-border"
                  disabled={isGeneratingCharts}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmGenerateCharts}
                  disabled={!selectedDatabaseForGenerate || isGeneratingCharts}
                  className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                >
                  {isGeneratingCharts ? (
                    <>
                      <Clock className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Charts
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
