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
import { getDashboards, deleteDashboard, type Dashboard as ApiDashboard } from "../services/api";

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
  dashboardRefreshTrigger?: number;
  pendingChartFromAI?: {
    id?: string;
    name: string;
    type: 'line' | 'bar' | 'pie' | 'area';
    dataSource: string;
    query: string;
    status: 'draft' | 'published';
    dashboardId?: number | string;
  } | null;
  onChartFromAIProcessed?: () => void;
  onOpenAIAssistant?: () => void;
  onEditChart?: (chart: { name: string; type: 'line' | 'bar' | 'pie' | 'area'; description?: string }) => void;
}

export function WorkspaceView({ projectName, onBack, isDark, activeTab, onTabChange, currentUser, projectId, chartCreatedTrigger, dashboardRefreshTrigger, pendingChartFromAI, onChartFromAIProcessed, onOpenAIAssistant, onEditChart }: WorkspaceViewProps) {
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

    // Dashboard creation is now handled through websocket events
    // The websocket workflow creates the dashboard and sends the created dashboard data
    // We just need to close the dialog and refresh the dashboards list
    try {
      // Close the Dashboard Assistant dialog immediately
      setIsCreateDialogOpen(false);
      
      toast.success(`Dashboard "${dashboard.name}" created successfully!`);
      
      // Add a small delay to ensure the backend has saved the dashboard
      // before we refresh the list
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh dashboards to get the newly created one
      await fetchDashboards();
    } catch (err: any) {
      toast.error(err.message || "An error occurred while fetching dashboard");
    }
  };

  const handleDeleteDashboard = async (dashboardId: string | number, dashboardName: string) => {
    if (!projectId) {
      toast.error("Project ID is required to delete a dashboard");
      return;
    }

    try {
      const response = await deleteDashboard(String(projectId), String(dashboardId));
      
      if (response.success) {
        // Remove dashboard from local state
        setDashboards(prevDashboards => prevDashboards.filter(d => d.id !== dashboardId));
        
        // If the deleted dashboard is currently selected, go back to dashboards list
        if (selectedDashboard && selectedDashboard.id === String(dashboardId)) {
          setSelectedDashboard(null);
        }
        
        toast.success(response.data?.message || `Dashboard "${dashboardName}" deleted successfully`);
      } else {
        toast.error(response.error?.message || "Failed to delete dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while deleting dashboard");
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
          onDelete={(dashboardId, dashboardName) => {
            handleDeleteDashboard(dashboardId, dashboardName);
            handleBackToDashboards(); // Navigate back after deletion
          }}
          onOpenAIAssistant={onOpenAIAssistant}
          onEditChart={onEditChart}
          refreshTrigger={dashboardRefreshTrigger}
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
            onDeleteDashboard={handleDeleteDashboard}
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
        <DialogContent className="max-w-5xl border-border p-0" hideCloseButton>
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
