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
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { toast } from "sonner";
import { getDashboards, createDashboard, type Dashboard as ApiDashboard } from "../services/api";

// UI Dashboard type (extends API Dashboard with display fields)
interface Dashboard {
  id: string | number;
  name: string;
  description: string;
  charts: number;
  lastUpdated: string;
  category?: string;
  icon: any;
  createdById?: number;
  projectId?: number | string;
  status?: 'active' | 'archived';
  collaborators?: number;
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

// Default icon for dashboards
const defaultIcon = LayoutDashboard;

interface WorkspaceViewProps {
  projectName: string;
  onBack: () => void;
  isDark: boolean;
  activeTab: string;
  onTabChange: (tab: string) => void;
  currentUser?: { id: number; name: string; email: string };
  projectId?: number | string;
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
  const [selectedDashboard, setSelectedDashboard] = useState<{ id: string; name: string } | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);

  // Fetch dashboards when projectId is available
  useEffect(() => {
    if (projectId) {
      fetchDashboards();
    }
  }, [projectId]);

  const fetchDashboards = async () => {
    if (!projectId) return;
    
    setIsLoadingDashboards(true);
    try {
      const response = await getDashboards(String(projectId));
      if (response.success && response.data) {
        // Map API dashboards to UI format
        const uiDashboards: Dashboard[] = response.data.map((dashboard) => ({
          id: dashboard.id,
          name: dashboard.name,
          description: dashboard.description,
          charts: dashboard.chartCount || 0,
          lastUpdated: formatTimeAgo(dashboard.updatedAt || dashboard.createdAt),
          icon: defaultIcon,
          createdById: currentUser?.id,
          projectId: dashboard.projectId || projectId,
          status: 'active' as const,
        }));
        setDashboards(uiDashboards);
      } else {
        toast.error(response.error?.message || "Failed to load dashboards");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while fetching dashboards");
    } finally {
      setIsLoadingDashboards(false);
    }
  };

  // Clear selected dashboard when activeTab changes (navigation from sidebar)
  useEffect(() => {
    setSelectedDashboard(null);
  }, [activeTab]);

  const handleViewDashboard = (dashboardName: string, dashboardId?: string | number) => {
    // Find the dashboard by name or ID to get the full dashboard info
    const dashboard = dashboards.find(d => 
      d.name === dashboardName || (dashboardId && d.id === dashboardId)
    );
    if (dashboard) {
      setSelectedDashboard({ id: String(dashboard.id), name: dashboard.name });
    } else {
      // Fallback to just name if dashboard not found in list
      setSelectedDashboard({ id: dashboardId ? String(dashboardId) : '', name: dashboardName });
    }
  };

  const handleBackToDashboards = () => {
    setSelectedDashboard(null);
  };

  const handleOpenCreateDialog = () => {
    setIsCreateDialogOpen(true);
  };

  const handleCreateDashboard = async (dashboard: {
    name: string;
    description?: string;
    enhancedDescription?: string;
  }) => {
    if (!projectId) {
      toast.error("Project ID is required to create a dashboard");
      return;
    }

    const description = dashboard.enhancedDescription || dashboard.description || "";

    try {
      const response = await createDashboard(String(projectId), {
      name: dashboard.name,
      description: description,
      });

      if (response.success && response.data) {
        // Add new dashboard to list with UI formatting
        const newDashboard: Dashboard = {
          id: response.data.id,
          name: response.data.name,
          description: response.data.description,
          charts: response.data.chartCount || 0,
          lastUpdated: "just now",
          icon: defaultIcon,
      createdById: currentUser?.id,
          projectId: response.data.projectId || projectId.toString(),
          status: 'active' as const,
    };
    setDashboards([newDashboard, ...dashboards]);
        setIsCreateDialogOpen(false);
    toast.success(`Dashboard "${dashboard.name}" created successfully!`);
      } else {
        toast.error(response.error?.message || "Failed to create dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while creating dashboard");
    }
  };

  const renderContent = () => {
    // If a dashboard is selected, show the detail view
    if (selectedDashboard) {
      return (
        <DashboardDetailView 
          dashboardId={selectedDashboard.id}
          dashboardName={selectedDashboard.name}
          projectId={projectId ? String(projectId) : undefined}
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
            isLoading={isLoadingDashboards}
          />
        );
      case 'charts':
        return <ChartsView currentUser={currentUser} projectId={projectId} key={chartCreatedTrigger} pendingChartFromAI={pendingChartFromAI} onChartFromAIProcessed={onChartFromAIProcessed} onOpenAIAssistant={onOpenAIAssistant} onEditChart={onEditChart} />;
      case 'databases':
        return <DatabasesView projectId={projectId} />;
      case 'insights':
        return <InsightsView projectId={projectId} />;
      case 'team':
        return <UsersView projectId={projectId} />;
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
            projectId={projectId ? String(projectId) : undefined}
            projectName={projectName}
            onCreate={(data) => {
              handleCreateDashboard({
                name: data.name,
                description: data.description,
                enhancedDescription: data.enhancedDescription,
              });
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
