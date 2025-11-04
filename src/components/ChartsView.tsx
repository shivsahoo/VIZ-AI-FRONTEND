import { useState, useEffect } from "react";
import { Search, Sparkles, BarChart3, LineChart, PieChart, AreaChart, Pin, Trash2, Calendar, Database, Plus, Clock, Edit2, Filter, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { usePinnedCharts } from "./PinnedChartsContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { ChartPreviewDialog } from "./ChartPreviewDialog";
import { toast } from "sonner@2.0.3";
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
  Tooltip,
  Legend,
} from "recharts";

interface Chart {
  id: number;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  dataSource: string;
  createdAt: string;
  lastUpdated: string;
  query?: string;
  status: 'draft' | 'published';
  dashboardId?: number;
  createdById?: number;
  projectId?: number;
  isGenerated?: boolean;
}

interface ChartSuggestion {
  id: string;
  name: string;
  type: 'line' | 'bar' | 'pie' | 'area';
  description: string;
  query: string;
  reasoning: string;
  dashboards?: string[];
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

// Mock chart data
const mockLineData = [
  { name: 'Jan', value: 400 },
  { name: 'Feb', value: 300 },
  { name: 'Mar', value: 600 },
  { name: 'Apr', value: 800 },
];

const mockBarData = [
  { name: 'A', value: 400 },
  { name: 'B', value: 300 },
  { name: 'C', value: 600 },
];

const mockPieData = [
  { name: 'A', value: 400 },
  { name: 'B', value: 300 },
  { name: 'C', value: 300 },
];

const mockAreaData = [
  { name: 'Jan', value: 200 },
  { name: 'Feb', value: 400 },
  { name: 'Mar', value: 300 },
  { name: 'Apr', value: 600 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"];

interface ChartsViewProps {
  currentUser?: { id: number; name: string; email: string };
  projectId?: number;
  onChartCreated?: (chart: Chart) => void;
  pendingChartFromAI?: {
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

export function ChartsView({ currentUser, projectId, onChartCreated, pendingChartFromAI, onChartFromAIProcessed, onOpenAIAssistant, onEditChart }: ChartsViewProps) {
  const { isPinned, togglePin } = usePinnedCharts();
  const [charts, setCharts] = useState<Chart[]>(initialCharts);
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

  // Simulate initial loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoadingCharts(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Handle pending chart from AI Assistant
  useEffect(() => {
    if (pendingChartFromAI) {
      const newChart: Chart = {
        id: Math.max(...charts.map(c => c.id), 0) + 1,
        name: pendingChartFromAI.name,
        type: pendingChartFromAI.type,
        dataSource: pendingChartFromAI.dataSource,
        createdAt: new Date().toISOString().split('T')[0],
        lastUpdated: "Just now",
        query: pendingChartFromAI.query,
        status: pendingChartFromAI.status,
        dashboardId: pendingChartFromAI.dashboardId,
        createdById: currentUser?.id,
        projectId: projectId
      };

      setCharts(prev => [newChart, ...prev]);
      
      if (pendingChartFromAI.status === 'draft') {
        toast.success(`Chart "${pendingChartFromAI.name}" saved as draft!`);
      } else {
        toast.success(`Chart "${pendingChartFromAI.name}" added to dashboard!`);
      }
      
      onChartFromAIProcessed?.();
    }
  }, [pendingChartFromAI, charts, currentUser, projectId, onChartFromAIProcessed]);

  const handleDeleteChart = () => {
    if (!chartToDelete) return;
    
    setCharts(charts.filter(c => c.id !== chartToDelete.id));
    setGeneratedCharts(generatedCharts.filter(c => c.id !== chartToDelete.id));
    toast.success(`Chart "${chartToDelete.name}" deleted successfully!`);
    setChartToDelete(null);
  };

  const handleTogglePin = (chart: Chart) => {
    const dashboard = mockDashboards.find(d => d.id === chart.dashboardId);
    const pinnedChartData = {
      id: chart.id,
      name: chart.name,
      description: `${chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} chart from ${chart.dataSource}`,
      lastUpdated: chart.lastUpdated,
      chartType: chart.type,
      category: chart.type.charAt(0).toUpperCase() + chart.type.slice(1),
      dashboardName: dashboard?.name || 'No Dashboard',
      dataSource: chart.dataSource
    };
    
    togglePin(pinnedChartData);
    
    if (isPinned(chart.id)) {
      toast.success(`"${chart.name}" unpinned from Home Dashboard`);
    } else {
      toast.success(`"${chart.name}" pinned to Home Dashboard`);
    }
  };

  const handleOpenChartPreview = (chart: Chart) => {
    // Find which dashboards this chart belongs to
    const chartDashboards = chart.dashboardId 
      ? [mockDashboards.find(d => d.id === chart.dashboardId)?.name].filter(Boolean) as string[]
      : [];
    
    const chartAsSuggestion: ChartSuggestion = {
      id: `existing-${chart.id}`,
      name: chart.name,
      type: chart.type,
      description: `${chart.type.charAt(0).toUpperCase() + chart.type.slice(1)} chart from ${chart.dataSource}`,
      query: chart.query || "",
      reasoning: `This is an existing chart from your ${chart.dataSource} database.`,
      dashboards: chartDashboards
    };
    setPreviewChart(chartAsSuggestion);
  };

  const handleGenerateCharts = () => {
    // Open AI Assistant slider for prompt-based generation
    // Database selection happens within the chatbot
    if (onOpenAIAssistant) {
      onOpenAIAssistant();
    }
  };



  const handleAddToDashboard = (chart: Chart) => {
    if (!selectedDashboardForAdd) {
      toast.error("Please select a dashboard");
      return;
    }

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

    const dashboard = mockDashboards.find(d => d.id === dashboardId);
    toast.success(`"${chart.name}" added to ${dashboard?.name}`);
    setChartToAddToDashboard(null);
    setSelectedDashboardForAdd("");
  };

  // Filter charts
  const filteredCharts = charts.filter(chart => {
    const matchesSearch = chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         chart.dataSource.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || chart.status === filterStatus;
    const matchesDashboard = filterDashboard === "all" || 
                            (filterDashboard === "unassigned" && !chart.dashboardId) ||
                            (chart.dashboardId && chart.dashboardId.toString() === filterDashboard);
    const matchesDatabase = filterDatabase === "all" || chart.dataSource === filterDatabase;
    
    return matchesSearch && matchesStatus && matchesDashboard && matchesDatabase;
  });

  const renderChartPreview = (chart: Chart) => {
    // Get chart-specific color
    const chartColor = {
      line: '#06B6D4',
      bar: '#8B5CF6',
      pie: '#10B981',
      area: '#F59E0B'
    }[chart.type];

    const PIE_COLORS = ["#06B6D4", "#5B67F1", "#8B5CF6"];
    
    return (
      <div className="h-[280px] bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg overflow-hidden p-4">
        {chart.type === 'line' && (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsLine data={mockLineData} margin={{ top: 5, right: 10, bottom: 5, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={35}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '2px solid #374151',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F9FAFB'
                }}
              />
              <Line type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2.5} dot={{ fill: chartColor, r: 3 }} />
            </RechartsLine>
          </ResponsiveContainer>
        )}
        {chart.type === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBar data={mockBarData} margin={{ top: 5, right: 10, bottom: 5, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={35}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '2px solid #374151',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F9FAFB'
                }}
              />
              <Bar dataKey="value" fill={chartColor} radius={[8, 8, 0, 0]} />
            </RechartsBar>
          </ResponsiveContainer>
        )}
        {chart.type === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsPie margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <Pie data={mockPieData} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={75}>
                {mockPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '2px solid #374151',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F9FAFB'
                }}
              />
            </RechartsPie>
          </ResponsiveContainer>
        )}
        {chart.type === 'area' && (
          <ResponsiveContainer width="100%" height="100%">
            <RechartsArea data={mockAreaData} margin={{ top: 5, right: 10, bottom: 5, left: -5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                width={35}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '2px solid #374151',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: '#F9FAFB'
                }}
              />
              <Area type="monotone" dataKey="value" stroke={chartColor} fill={chartColor} fillOpacity={0.3} strokeWidth={2.5} />
            </RechartsArea>
          </ResponsiveContainer>
        )}
      </div>
    );
  };

  const renderChartCard = (chart: Chart, isGenerated: boolean = false) => {
    const Icon = chartTypeIcons[chart.type];
    const dashboard = mockDashboards.find(d => d.id === chart.dashboardId);
    const colorClass = {
      line: 'text-[#06B6D4] bg-[#06B6D4]/10',
      bar: 'text-[#8B5CF6] bg-[#8B5CF6]/10',
      pie: 'text-[#10B981] bg-[#10B981]/10',
      area: 'text-[#F59E0B] bg-[#F59E0B]/10'
    }[chart.type];

    return (
      <Card
        key={chart.id}
        className="overflow-hidden border-2 border-border hover:border-primary/30 hover:shadow-xl transition-smooth cursor-pointer group hover-lift card-shadow relative"
        onClick={() => !isGenerated && handleOpenChartPreview(chart)}
      >
        {/* Compact Header - Overlaid on chart */}
        <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-card via-card/95 to-transparent pb-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass} transition-smooth group-hover:scale-110`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-foreground group-hover:text-primary transition-colors line-clamp-1 mb-1">
                  {chart.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="line-clamp-1">{chart.dataSource}</span>
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
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditChart) {
                    onEditChart({
                      name: chart.name,
                      type: chart.type,
                      description: chart.dataSource
                    });
                  }
                  if (onOpenAIAssistant) {
                    onOpenAIAssistant();
                  }
                }}
                className="h-7 w-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit chart"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setChartToDelete(chart);
                }}
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin(chart);
                }}
                className={`h-7 w-7 ${
                  isPinned(chart.id)
                    ? 'text-primary hover:text-primary/80'
                    : 'text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100'
                } transition-opacity`}
                title={isPinned(chart.id) ? "Unpin chart" : "Pin chart"}
              >
                <Pin className={`w-3.5 h-3.5 ${isPinned(chart.id) ? 'fill-primary/20 rotate-45' : ''}`} />
              </Button>
            </div>
          </div>
        </div>

        {/* Chart Visualization */}
        <div className="pt-24 px-2 pb-2">
          {renderChartPreview(chart)}
        </div>

        {/* Status Badge at Bottom */}
        {chart.status === 'published' && dashboard && (
          <div className="px-4 pb-3">
            <Badge variant="outline" className="text-xs border-success/30 text-success bg-success/10">
              {dashboard.name}
            </Badge>
          </div>
        )}
        {chart.status === 'draft' && (
          <div className="px-4 pb-3">
            <Badge variant="outline" className="text-xs border-warning/30 text-warning bg-warning/10">
              Draft
            </Badge>
          </div>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-6 border-2 border-border card-shadow">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted/50 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                  <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
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
          <Button
            onClick={handleGenerateCharts}
            size="sm"
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white h-9"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            Generate Charts
          </Button>
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
                            {mockDashboards.map((dashboard) => (
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
                            {mockDatabases.map((database) => (
                              <SelectItem key={database.id} value={database.name}>
                                {database.name}
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
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
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
                  {mockDashboards.map((dashboard) => (
                    <SelectItem key={dashboard.id} value={dashboard.id.toString()}>
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
            onAddToDashboard={(dashboardId) => {
              const dashboard = mockDashboards.find(d => d.id === dashboardId);
              toast.success(`Chart added to "${dashboard?.name}"!`);
              setPreviewChart(null);
            }}
            onSaveAsDraft={() => {
              toast.success(`Chart "${previewChart.name}" saved as draft!`);
              setPreviewChart(null);
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
      </div>
    </div>
  );
}
