import { useState, useRef, useEffect } from "react";
import { X, Plus, ChevronDown, LayoutDashboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../ui/dialog";
import { Button } from "../../ui/button";
import { Badge } from "../../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { ChartCard } from "./ChartCard";
import { toast } from "sonner";

interface ChartPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  chart: {
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    description: string;
    query: string;
    reasoning: string;
    dashboards?: string[]; // Array of dashboard names this chart belongs to
  } | null;
  onAddToDashboard: (dashboardId: number) => void;
  onSaveAsDraft: () => void;
  isExistingChart?: boolean;
  chartStatus?: 'draft' | 'published';
}

interface Dashboard {
  id: number;
  name: string;
}

// Mock dashboards
const mockDashboards: Dashboard[] = [
  { id: 1, name: "Revenue Overview" },
  { id: 2, name: "Customer Analytics" },
  { id: 3, name: "Sales Performance" },
  { id: 4, name: "Product Metrics" },
  { id: 5, name: "Marketing ROI" },
  { id: 6, name: "Operations Dashboard" }
];

// Mock data for different chart types
const mockLineData = [
  { month: 'Jan', revenue: 4500, expenses: 3200 },
  { month: 'Feb', revenue: 5200, expenses: 3400 },
  { month: 'Mar', revenue: 4800, expenses: 3100 },
  { month: 'Apr', revenue: 6100, expenses: 3800 },
  { month: 'May', revenue: 5800, expenses: 3600 },
  { month: 'Jun', revenue: 7200, expenses: 4200 },
  { month: 'Jul', revenue: 6900, expenses: 4000 },
  { month: 'Aug', revenue: 7800, expenses: 4500 },
  { month: 'Sep', revenue: 8200, expenses: 4800 },
  { month: 'Oct', revenue: 7500, expenses: 4300 },
  { month: 'Nov', revenue: 8900, expenses: 5100 },
  { month: 'Dec', revenue: 9500, expenses: 5400 }
];

const mockBarData = [
  { category: 'Electronics', sales: 12500 },
  { category: 'Clothing', sales: 8900 },
  { category: 'Food', sales: 15200 },
  { category: 'Books', sales: 6700 },
  { category: 'Home', sales: 11300 },
  { category: 'Sports', sales: 7800 }
];

const mockPieData = [
  { name: 'North America', value: 45, color: '#06B6D4' },
  { name: 'Europe', value: 28, color: '#6366F1' },
  { name: 'Asia', value: 18, color: '#8B5CF6' },
  { name: 'South America', value: 6, color: '#F59E0B' },
  { name: 'Africa', value: 3, color: '#EF4444' }
];

const mockAreaData = [
  { date: 'Mon', orders: 120 },
  { date: 'Tue', orders: 145 },
  { date: 'Wed', orders: 132 },
  { date: 'Thu', orders: 168 },
  { date: 'Fri', orders: 195 },
  { date: 'Sat', orders: 210 },
  { date: 'Sun', orders: 178 }
];

export function ChartPreviewDialog({ isOpen, onClose, chart, onAddToDashboard, onSaveAsDraft, isExistingChart = false, chartStatus }: ChartPreviewDialogProps) {
  const [selectedDashboard, setSelectedDashboard] = useState<number | null>(null);

  if (!chart) return null;

  const handleAddToDashboard = (dashboardId: number) => {
    const dashboard = mockDashboards.find(d => d.id === dashboardId);
    onAddToDashboard(dashboardId);
    toast.success(`Chart added to "${dashboard?.name}"!`);
    onClose();
  };

  const handleSaveAsDraft = () => {
    onSaveAsDraft();
    toast.success("Chart saved as draft!");
    onClose();
  };

  const getChartData = () => {
    switch (chart.type) {
      case 'line':
        return { data: mockLineData, dataKeys: { primary: 'revenue', secondary: 'expenses' }, xAxisKey: 'month', colors: ['#06B6D4', '#6366F1'] };
      case 'bar':
        return { data: mockBarData, dataKeys: { primary: 'sales' }, xAxisKey: 'category', colors: ['#8B5CF6'] };
      case 'pie':
        return { data: mockPieData, dataKeys: { primary: 'value' }, xAxisKey: 'name' };
      case 'area':
        return { data: mockAreaData, dataKeys: { primary: 'orders' }, xAxisKey: 'date', colors: ['#F59E0B'] };
      default:
        return { data: [], dataKeys: { primary: 'value' }, xAxisKey: 'name' };
    }
  };

  const chartData = getChartData();

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
                {chart.description}
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
          <div className="w-full h-[400px]">
            <ChartCard
              type={chart.type}
              data={chartData.data}
              dataKeys={chartData.dataKeys}
              xAxisKey={chartData.xAxisKey}
              colors={chartData.colors}
              height={400}
            />
          </div>
        </div>

        {/* SQL Query Section */}
        <div className="space-y-3 max-h-48 overflow-y-auto">
          <div>
            <p className="text-sm text-muted-foreground mb-2">AI Reasoning:</p>
            <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">
              {chart.reasoning}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">SQL Query:</p>
            <pre className="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto">
              <code className="text-foreground">{chart.query}</code>
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
            >
              Save as Draft
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white gap-2">
                <Plus className="w-4 h-4" />
                Add to Dashboard
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[250px]">
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                Select a dashboard
              </div>
              {mockDashboards.map((dashboard) => (
                <DropdownMenuItem
                  key={dashboard.id}
                  onClick={() => handleAddToDashboard(dashboard.id)}
                  className="cursor-pointer"
                >
                  {dashboard.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogContent>
    </Dialog>
  );
}
