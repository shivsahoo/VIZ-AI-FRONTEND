import { type MouseEvent } from "react";
import { LayoutDashboard, Clock, BarChart3, Users, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, ResponsiveContainer } from "recharts";

interface Dashboard {
  id: number;
  name: string;
  description: string;
  charts: number;
  lastUpdated: string;
  icon?: any;
  collaborators?: number;
}

interface DashboardCardProps {
  dashboard: Dashboard;
  viewMode: 'grid' | 'list';
  onDelete: (e: MouseEvent) => void;
  onClick: () => void;
}

// Sample data for chart previews
const chartData = [
  { name: 'A', value: 30 },
  { name: 'B', value: 45 },
  { name: 'C', value: 35 },
  { name: 'D', value: 50 },
  { name: 'E', value: 42 },
  { name: 'F', value: 55 }
];

// Mini chart preview component
function MiniChartPreview({ index }: { index: number }) {
  const chartType = index % 3;
  
  return (
    <div className="w-full h-full bg-gradient-to-br from-muted/20 to-muted/5 rounded-lg overflow-hidden border border-border/40">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === 0 ? (
          <LineChart data={chartData}>
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--chart-1))" 
              strokeWidth={1.5} 
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        ) : chartType === 1 ? (
          <BarChart data={chartData}>
            <Bar 
              dataKey="value" 
              fill="hsl(var(--chart-2))" 
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        ) : (
          <AreaChart data={chartData}>
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="hsl(var(--chart-3))" 
              fill="hsl(var(--chart-3))" 
              fillOpacity={0.3}
              isAnimationActive={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function DashboardCard({ 
  dashboard, 
  viewMode,
  onDelete, 
  onClick 
}: DashboardCardProps) {
  const Icon = dashboard.icon || LayoutDashboard;

  if (viewMode === 'list') {
    return (
      <div
        className="p-5 hover:bg-muted/30 transition-colors cursor-pointer group flex items-center gap-6 relative"
        onClick={onClick}
      >
        {/* Dashboard Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground mb-1">{dashboard.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {dashboard.description}
            </p>
          </div>
        </div>

        {/* Chart Previews */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-16 h-12">
            <MiniChartPreview index={0} />
          </div>
          <div className="w-16 h-12">
            <MiniChartPreview index={1} />
          </div>
          <div className="w-16 h-12">
            <MiniChartPreview index={2} />
          </div>
        </div>

        {/* Stats - Compact Horizontal */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{dashboard.charts}</span>
          </div>
          {dashboard.collaborators && (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{dashboard.collaborators}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{dashboard.lastUpdated}</span>
          </div>
        </div>

        {/* Delete Action - Top Right */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // Grid view
  return (
    <Card
      className="border-border hover:border-primary/30 transition-all duration-200 cursor-pointer group overflow-hidden relative"
      onClick={onClick}
    >
      {/* Delete Action - Top Right */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="absolute top-3 right-3 h-8 w-8 z-10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-4 h-4" />
      </Button>

      <div className="p-5 space-y-4">
        {/* Dashboard Header */}
        <div className="flex items-start gap-3 pr-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground mb-1">{dashboard.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {dashboard.description}
            </p>
          </div>
        </div>

        {/* Chart Previews Grid */}
        <div className="grid grid-cols-3 gap-2 h-20">
          <MiniChartPreview index={0} />
          <MiniChartPreview index={1} />
          <MiniChartPreview index={2} />
        </div>

        {/* Dashboard Stats - Compact Horizontal */}
        <div className="flex items-center justify-between pt-3 border-t border-border text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>{dashboard.charts}</span>
            </div>
            {dashboard.collaborators && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>{dashboard.collaborators}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="whitespace-nowrap">{dashboard.lastUpdated}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
