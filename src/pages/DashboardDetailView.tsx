import { useState } from "react";
import { ArrowLeft, Download, Plus, Edit2, X, Pin, Sparkles } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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

interface DashboardDetailViewProps {
  dashboardName: string;
  onBack: () => void;
  onOpenAIAssistant?: () => void;
  onEditChart?: (chart: { name: string; type: 'line' | 'bar' | 'pie' | 'area'; description?: string }) => void;
}

// Mock data for charts
const revenueData = [
  { month: "Jan", revenue: 45000, target: 50000 },
  { month: "Feb", revenue: 52000, target: 50000 },
  { month: "Mar", revenue: 48000, target: 50000 },
  { month: "Apr", revenue: 61000, target: 55000 },
  { month: "May", revenue: 58000, target: 55000 },
  { month: "Jun", revenue: 67000, target: 60000 },
];

const customerData = [
  { name: "Direct", value: 4200 },
  { name: "Organic", value: 3100 },
  { name: "Referral", value: 2400 },
  { name: "Social", value: 1900 },
];

const performanceData = [
  { week: "Week 1", sales: 23, conversions: 18 },
  { week: "Week 2", sales: 31, conversions: 25 },
  { week: "Week 3", sales: 28, conversions: 22 },
  { week: "Week 4", sales: 42, conversions: 35 },
];

interface ChartCardData {
  id: string;
  title: string;
  description: string;
  type: 'line' | 'bar' | 'pie' | 'area';
}

export function DashboardDetailView({ dashboardName, onBack, onOpenAIAssistant, onEditChart }: DashboardDetailViewProps) {
  const { isPinned, togglePin } = usePinnedCharts();
  const [chartToRemove, setChartToRemove] = useState<ChartCardData | null>(null);
  const [visibleCharts, setVisibleCharts] = useState<string[]>([
    'revenue-chart',
    'customer-chart',
    'performance-chart',
    'trend-chart'
  ]);

  const handleEditChart = (chart: ChartCardData) => {
    // Pass chart info to parent
    if (onEditChart) {
      onEditChart({
        name: chart.title,
        type: chart.type === 'composed' ? 'line' : chart.type,
        description: chart.description
      });
    }
    // Open AI Assistant for editing
    if (onOpenAIAssistant) {
      onOpenAIAssistant();
    }
  };

  const handleRemoveChart = (chartId: string) => {
    setVisibleCharts(prev => prev.filter(id => id !== chartId));
    toast.success(`Chart removed from dashboard`);
    setChartToRemove(null);
  };

  const isChartVisible = (chartId: string) => visibleCharts.includes(chartId);

  const handleTogglePin = (chartData: ChartCardData) => {
    // Create a numeric ID from the string ID
    const numericId = chartData.id === 'revenue-chart' ? 10 : 
                      chartData.id === 'customer-chart' ? 11 :
                      chartData.id === 'performance-chart' ? 12 :
                      chartData.id === 'trend-chart' ? 13 : 0;

    const pinnedChartData = {
      id: numericId,
      name: chartData.title,
      description: chartData.description,
      lastUpdated: 'Just now',
      chartType: chartData.type,
      category: chartData.type.charAt(0).toUpperCase() + chartData.type.slice(1),
      dashboardName: dashboardName,
      dataSource: 'Dashboard Data'
    };
    
    togglePin(pinnedChartData);
    
    if (isPinned(numericId)) {
      toast.success(`"${chartData.title}" unpinned from Home Dashboard`);
    } else {
      toast.success(`"${chartData.title}" pinned to Home Dashboard`);
    }
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
                <p className="text-muted-foreground text-sm">Last updated 2 hours ago</p>
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
            <Button 
              onClick={onOpenAIAssistant}
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Create Chart
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Total Revenue</p>
            <p className="text-3xl text-foreground mb-1">$331K</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-success">↑ 12.5%</span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          </Card>
          
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Avg. Revenue/Month</p>
            <p className="text-3xl text-foreground mb-1">$55.2K</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-success">↑ 8.2%</span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          </Card>
          
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Target Achievement</p>
            <p className="text-3xl text-foreground mb-1">108%</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-success">↑ 5.3%</span>
              <span className="text-muted-foreground">vs target</span>
            </div>
          </Card>
          
          <Card className="p-6 border border-border">
            <p className="text-sm text-muted-foreground mb-2">Growth Rate</p>
            <p className="text-3xl text-foreground mb-1">18.4%</p>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-success">↑ 2.1%</span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          {isChartVisible('revenue-chart') && (
            <Card className="p-6 border border-border relative group">
              {/* Chart Actions */}
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-8 w-8 border-border ${
                    isPinned(10)
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleTogglePin({
                    id: 'revenue-chart',
                    title: 'Monthly Revenue vs Target',
                    description: 'Track revenue performance against targets',
                    type: 'line'
                  })}
                  title={isPinned(10) ? "Unpin from Home" : "Pin to Home"}
                >
                  <Pin className={`w-4 h-4 ${isPinned(10) ? 'fill-primary/20 rotate-45' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-muted"
                  onClick={() => handleEditChart({
                    id: 'revenue-chart',
                    title: 'Monthly Revenue vs Target',
                    description: 'Track revenue performance against targets',
                    type: 'line'
                  })}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setChartToRemove({
                    id: 'revenue-chart',
                    title: 'Monthly Revenue vs Target',
                    description: 'Track revenue performance against targets',
                    type: 'line'
                  })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="mb-6">
                <h3 className="text-lg text-foreground mb-1">Monthly Revenue vs Target</h3>
                <p className="text-sm text-muted-foreground">Track revenue performance against targets</p>
              </div>
              <ChartCard
                type="line"
                data={revenueData}
                dataKeys={{ primary: 'revenue', secondary: 'target' }}
                xAxisKey="month"
                height={300}
              />
            </Card>
          )}

          {/* Pie Chart */}
          {isChartVisible('customer-chart') && (
            <Card className="p-6 border border-border relative group">
              {/* Chart Actions */}
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-8 w-8 border-border ${
                    isPinned(11)
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleTogglePin({
                    id: 'customer-chart',
                    title: 'Customer Acquisition Channels',
                    description: 'Distribution of customer sources',
                    type: 'pie'
                  })}
                  title={isPinned(11) ? "Unpin from Home" : "Pin to Home"}
                >
                  <Pin className={`w-4 h-4 ${isPinned(11) ? 'fill-primary/20 rotate-45' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-muted"
                  onClick={() => handleEditChart({
                    id: 'customer-chart',
                    title: 'Customer Acquisition Channels',
                    description: 'Distribution of customer sources',
                    type: 'pie'
                  })}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setChartToRemove({
                    id: 'customer-chart',
                    title: 'Customer Acquisition Channels',
                    description: 'Distribution of customer sources',
                    type: 'pie'
                  })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="mb-6">
                <h3 className="text-lg text-foreground mb-1">Customer Acquisition Channels</h3>
                <p className="text-sm text-muted-foreground">Distribution of customer sources</p>
              </div>
              <ChartCard
                type="pie"
                data={customerData}
                dataKeys={{ primary: 'value' }}
                xAxisKey="name"
                height={300}
              />
            </Card>
          )}

          {/* Bar Chart */}
          {isChartVisible('performance-chart') && (
            <Card className="p-6 border border-border relative group">
              {/* Chart Actions */}
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-8 w-8 border-border ${
                    isPinned(12)
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleTogglePin({
                    id: 'performance-chart',
                    title: 'Weekly Sales Performance',
                    description: 'Sales and conversion metrics by week',
                    type: 'bar'
                  })}
                  title={isPinned(12) ? "Unpin from Home" : "Pin to Home"}
                >
                  <Pin className={`w-4 h-4 ${isPinned(12) ? 'fill-primary/20 rotate-45' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-muted"
                  onClick={() => handleEditChart({
                    id: 'performance-chart',
                    title: 'Weekly Sales Performance',
                    description: 'Sales and conversion metrics by week',
                    type: 'bar'
                  })}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setChartToRemove({
                    id: 'performance-chart',
                    title: 'Weekly Sales Performance',
                    description: 'Sales and conversion metrics by week',
                    type: 'bar'
                  })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="mb-6">
                <h3 className="text-lg text-foreground mb-1">Weekly Sales Performance</h3>
                <p className="text-sm text-muted-foreground">Sales and conversion metrics by week</p>
              </div>
              <ChartCard
                type="bar"
                data={performanceData}
                dataKeys={{ primary: 'sales', secondary: 'conversions' }}
                xAxisKey="week"
                height={300}
              />
            </Card>
          )}

          {/* Area Chart */}
          {isChartVisible('trend-chart') && (
            <Card className="p-6 border border-border relative group">
              {/* Chart Actions */}
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-8 w-8 border-border ${
                    isPinned(13)
                      ? 'bg-primary/10 text-primary hover:bg-primary/20'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => handleTogglePin({
                    id: 'trend-chart',
                    title: 'Revenue Trend',
                    description: 'Cumulative revenue over time',
                    type: 'area'
                  })}
                  title={isPinned(13) ? "Unpin from Home" : "Pin to Home"}
                >
                  <Pin className={`w-4 h-4 ${isPinned(13) ? 'fill-primary/20 rotate-45' : ''}`} />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-muted"
                  onClick={() => handleEditChart({
                    id: 'trend-chart',
                    title: 'Revenue Trend',
                    description: 'Cumulative revenue over time',
                    type: 'area'
                  })}
                >
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-border hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setChartToRemove({
                    id: 'trend-chart',
                    title: 'Revenue Trend',
                    description: 'Cumulative revenue over time',
                    type: 'area'
                  })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="mb-6">
                <h3 className="text-lg text-foreground mb-1">Revenue Trend</h3>
                <p className="text-sm text-muted-foreground">Cumulative revenue over time</p>
              </div>
              <ChartCard
                type="area"
                data={revenueData}
                dataKeys={{ primary: 'revenue' }}
                xAxisKey="month"
                height={300}
              />
            </Card>
          )}
        </div>

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
