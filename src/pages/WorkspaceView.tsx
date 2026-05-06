import { useState, useEffect, useRef } from "react";
import { Database, LayoutDashboard, Lightbulb, TrendingUp, BarChart3, PieChart, LineChart } from "lucide-react";
import { HomeDashboardView } from "./HomeDashboardView";
import { DatabasesView } from "./DatabasesView";
import { DashboardsView } from "./DashboardsView";
import { ChartsView } from "./ChartsView";
import { InsightsView } from "./InsightsView";
import { UsersView } from "./UsersView";
import { DashboardDetailView } from "./DashboardDetailView";
import { DashboardCreationForm } from "../components/features/dashboards/DashboardCreationForm";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { toast } from "sonner";
import { getDashboards, deleteDashboard, type Dashboard as ApiDashboard } from "../services/api";

const getErrorMessage = (error: any): string => {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (error instanceof Error && typeof error.message === "string") return error.message;
  if (typeof error?.message === "string") return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong";
  }
};

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
  // Restore selected dashboard from localStorage
  const [selectedDashboard, setSelectedDashboard] = useState<{ id: string; name: string } | null>(() => {
    if (typeof window !== 'undefined' && projectId) {
      const savedDashboardId = localStorage.getItem(`vizai_selected_dashboard_${projectId}`);
      const savedDashboardName = localStorage.getItem(`vizai_selected_dashboard_name_${projectId}`);
      if (savedDashboardId && savedDashboardName) {
        return { id: savedDashboardId, name: savedDashboardName };
      }
    }
    return null;
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoadingDashboards, setIsLoadingDashboards] = useState(false);
  const isRestoringDashboardRef = useRef(false);

  // Fetch dashboards when projectId is available
  useEffect(() => {
    if (projectId) {
      fetchDashboards();
    }
  }, [projectId]);

  const fetchDashboards = async (): Promise<Dashboard[] | null> => {
    if (!projectId) return null;
    
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
        
        // Restore selected dashboard if it exists and is still valid
        if (!selectedDashboard) {
          const savedDashboardId = localStorage.getItem(`vizai_selected_dashboard_${projectId}`);
          const savedDashboardName = localStorage.getItem(`vizai_selected_dashboard_name_${projectId}`);
          if (savedDashboardId && savedDashboardName) {
            // Verify dashboard still exists
            const dashboardExists = uiDashboards.find(
              d => String(d.id) === savedDashboardId || d.name === savedDashboardName
            );
            if (dashboardExists) {
              // Restore dashboard and switch to dashboards tab
              isRestoringDashboardRef.current = true;
              setSelectedDashboard({ id: String(dashboardExists.id), name: dashboardExists.name });
              // Switch to dashboards tab to show the restored dashboard
              if (activeTab !== 'dashboards') {
                onTabChange('dashboards');
              }
              // Reset flag after a short delay
              setTimeout(() => {
                isRestoringDashboardRef.current = false;
              }, 100);
            } else {
              // Dashboard no longer exists, clear from localStorage
              localStorage.removeItem(`vizai_selected_dashboard_${projectId}`);
              localStorage.removeItem(`vizai_selected_dashboard_name_${projectId}`);
            }
          }
        }
        return uiDashboards;
      } else {
        toast.error(response.error?.message || "Failed to load dashboards");
        return null;
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while fetching dashboards");
      return null;
    } finally {
      setIsLoadingDashboards(false);
    }
  };

  // Save selected dashboard to localStorage
  useEffect(() => {
    if (projectId && selectedDashboard) {
      localStorage.setItem(`vizai_selected_dashboard_${projectId}`, selectedDashboard.id);
      localStorage.setItem(`vizai_selected_dashboard_name_${projectId}`, selectedDashboard.name);
    } else if (projectId && !selectedDashboard) {
      // Clear saved dashboard when deselected (but not during initial restore)
      const savedDashboardId = localStorage.getItem(`vizai_selected_dashboard_${projectId}`);
      if (!savedDashboardId) {
        // Only clear if there's no saved dashboard (user explicitly navigated away)
        localStorage.removeItem(`vizai_selected_dashboard_${projectId}`);
        localStorage.removeItem(`vizai_selected_dashboard_name_${projectId}`);
      }
    }
  }, [selectedDashboard, projectId]);

  // Clear selected dashboard when activeTab changes (navigation from sidebar)
  // But only if it's a user-initiated navigation, not during restore
  useEffect(() => {
    // Don't clear if we're restoring a dashboard
    if (isRestoringDashboardRef.current) {
      return;
    }
    // Only clear if dashboards are loaded and user navigated away from dashboards tab
    if (dashboards.length > 0 && activeTab !== 'dashboards' && selectedDashboard) {
      setSelectedDashboard(null);
    }
  }, [activeTab, dashboards.length, selectedDashboard]);

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
    dashboardId?: string;
  }) => {
    if (!projectId) {
      toast.error("Project ID is required to create a dashboard");
      return;
    }

    try {
      setIsCreateDialogOpen(false);
      
      // Refresh dashboards to get the newly created one
      const updatedDashboards = await fetchDashboards();
      
      // Find the newly created dashboard (prefer id) and navigate to it
      if (updatedDashboards) {
        const newDashboard = updatedDashboards.find(d =>
          (dashboard.dashboardId && String(d.id) === String(dashboard.dashboardId)) ||
          d.name === dashboard.name
        );
        if (newDashboard) {
          // Navigate to the newly created dashboard
          handleViewDashboard(newDashboard.name, newDashboard.id);
          // Ensure we're on the dashboards tab
          if (activeTab !== 'dashboards') {
            onTabChange('dashboards');
          }
        }
      }
    } catch (err: any) {
      toast.error(getErrorMessage(err) || "An error occurred while creating dashboard");
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
        <DialogContent 
          className="!max-w-6xl sm:!max-w-6xl border-border p-0" 
          style={{ maxWidth: '72rem' }}
          hideCloseButton
        >
          <div className="sr-only">
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>
              Create a new dashboard by providing a name and description.
            </DialogDescription>
          </div>
          {projectId ? (
            <div className="p-6">
              <DashboardCreationForm
                projectId={String(projectId)}
                onCancel={() => setIsCreateDialogOpen(false)}
                onComplete={(data) => {
                  handleCreateDashboard({
                    name: data.name,
                    dashboardId: data.dashboardId,
                  });
                }}
              />
            </div>
          ) : (
            <div className="p-10">
              <LoadingSpinner size="lg" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
