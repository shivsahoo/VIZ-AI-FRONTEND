import { useState, useEffect } from "react";
import { Database, LayoutDashboard, Lightbulb, TrendingUp, BarChart3, PieChart, LineChart } from "lucide-react";
import { HomeDashboardView } from "./HomeDashboardView";
import { DatabasesView } from "./DatabasesView";
import { DashboardsView } from "./DashboardsView";
import { ChartsView } from "./ChartsView";
import { InsightsView } from "./InsightsView";
import { UsersView } from "./UsersView";
import { DashboardDetailView } from "./DashboardDetailView";
import { DashboardCreationBot } from "../components/features/dashboards/DashboardCreationBot";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { toast } from "sonner";

interface Dashboard {
  id: number;
  name: string;
  description: string;
  charts: number;
  lastUpdated: string;
  category?: string;
  icon: any;
  createdById?: number;
  projectId?: number;
}

const initialDashboards: Dashboard[] = [
  {
    id: 1,
    name: "Revenue Overview",
    description: "Monthly revenue trends and forecasts",
    charts: 6,
    lastUpdated: "2 hours ago",
    category: "Finance",
    icon: TrendingUp
  },
  {
    id: 2,
    name: "Customer Analytics",
    description: "User behavior and retention metrics",
    charts: 8,
    lastUpdated: "5 minutes ago",
    category: "Marketing",
    icon: BarChart3
  },
  {
    id: 3,
    name: "Sales Performance",
    description: "Sales team KPIs and pipeline analysis",
    charts: 5,
    lastUpdated: "1 hour ago",
    category: "Sales",
    icon: PieChart
  },
  {
    id: 4,
    name: "Product Metrics",
    description: "Feature usage and engagement tracking",
    charts: 10,
    lastUpdated: "30 minutes ago",
    category: "Product",
    icon: LineChart
  },
  {
    id: 5,
    name: "Marketing ROI",
    description: "Campaign performance across channels",
    charts: 7,
    lastUpdated: "3 hours ago",
    category: "Marketing",
    icon: TrendingUp
  },
  {
    id: 6,
    name: "Operations Dashboard",
    description: "Operational efficiency and costs",
    charts: 4,
    lastUpdated: "1 day ago",
    category: "Operations",
    icon: BarChart3
  }
];

interface WorkspaceViewProps {
  projectName: string;
  onBack: () => void;
  isDark: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: { id: number; name: string; email: string };
  projectId?: number;
  chartCreatedTrigger?: number;
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

export function WorkspaceView({ projectName, onBack, isDark, activeTab, onTabChange, currentUser, projectId, chartCreatedTrigger, pendingChartFromAI, onChartFromAIProcessed, onOpenAIAssistant, onEditChart }: WorkspaceViewProps) {
  const [selectedDashboard, setSelectedDashboard] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>(initialDashboards);

  // Clear selected dashboard when activeTab changes (navigation from sidebar)
  useEffect(() => {
    setSelectedDashboard(null);
  }, [activeTab]);

  const handleViewDashboard = (dashboardName: string) => {
    setSelectedDashboard(dashboardName);
  };

  const handleBackToDashboards = () => {
    setSelectedDashboard(null);
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateDashboard = (dashboard: {
    name: string;
    description: string;
  }) => {
    // Create a new dashboard object
    const newDashboard: Dashboard = {
      id: Math.max(...dashboards.map(d => d.id), 0) + 1,
      name: dashboard.name,
      description: dashboard.description,
      charts: 0,
      lastUpdated: "Just now",
      icon: LayoutDashboard,
      createdById: currentUser?.id,
      projectId: projectId
    };

    // Add to dashboards list
    setDashboards([newDashboard, ...dashboards]);
    
    // Show success message
    toast.success(`Dashboard "${dashboard.name}" created successfully!`);
  };

  const renderContent = () => {
    // If a dashboard is selected, show the detail view
    if (selectedDashboard) {
      return (
        <DashboardDetailView 
          dashboardName={selectedDashboard}
          onBack={handleBackToDashboards}
          onOpenAIAssistant={onOpenAIAssistant}
          onEditChart={onEditChart}
        />
      );
    }

    switch (activeTab) {
      case 'home':
        return (
          <HomeDashboardView 
            onNavigate={onTabChange}
            onOpenAIAssistant={onOpenAIAssistant}
          />
        );
      case 'dashboards':
        return (
          <DashboardsView 
            dashboards={dashboards}
            onViewDashboard={handleViewDashboard}
            onCreateDashboard={handleOpenCreateDialog}
          />
        );
      case 'charts':
        return <ChartsView currentUser={currentUser} projectId={projectId} key={chartCreatedTrigger} pendingChartFromAI={pendingChartFromAI} onChartFromAIProcessed={onChartFromAIProcessed} onOpenAIAssistant={onOpenAIAssistant} onEditChart={onEditChart} />;
      case 'databases':
        return <DatabasesView />;
      case 'insights':
        return <InsightsView />;
      case 'team':
        return <UsersView />;
      default:
        return (
          <HomeDashboardView 
            onNavigate={onTabChange}
            onOpenAIAssistant={onOpenAIAssistant}
          />
        );
    }
  };

  return (
    <>
      {/* Full Width Content - No Sidebar */}
      <div className="h-full overflow-auto bg-background">
        {renderContent()}
      </div>

      {/* Create Dashboard Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-5xl border-border p-0">
          <div className="sr-only">
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>
              Use the AI assistant to create a new dashboard by providing a name, selecting databases, and describing your requirements.
            </DialogDescription>
          </div>
          <DashboardCreationBot
            isOpen={isCreateDialogOpen}
            onClose={() => setIsCreateDialogOpen(false)}
            onCreate={(name, description) => {
              handleCreateDashboard({ name, description });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
