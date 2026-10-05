import { useState, useEffect } from "react";
import { Plus, LayoutDashboard, Search } from "lucide-react";
import { Input } from "../components/ui/input";
import { GradientButton } from "../components/shared/GradientButton";
import { ViewModeToggle } from "../components/shared/ViewModeToggle";
import { SkeletonGrid } from "../components/shared/SkeletonCard";
import { DashboardCard } from "../components/features/dashboards/DashboardCard";
import { toast } from "sonner";
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

interface Dashboard {
  id: number | string;
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

interface DashboardsViewProps {
  dashboards: Dashboard[];
  onViewDashboard?: (dashboardName: string, dashboardId?: string | number) => void;
  onCreateDashboard?: () => void;
  onDeleteDashboard?: (dashboardId: string | number, dashboardName: string) => void;
  isLoading?: boolean;
}

export function DashboardsView({ dashboards, onViewDashboard, onCreateDashboard, onDeleteDashboard, isLoading: externalIsLoading }: DashboardsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null);

  // Use external loading state if provided, otherwise use local state (for backward compatibility)
  const isLoading = externalIsLoading !== undefined ? externalIsLoading : false;

  const handleCreateDashboard = () => {
    // Notify parent to open the creation dialog
    onCreateDashboard?.();
  };

  const handleDeleteDashboard = () => {
    if (dashboardToDelete) {
      // Call the parent's delete handler which will handle the API call
      onDeleteDashboard?.(dashboardToDelete.id, dashboardToDelete.name);
      setDashboardToDelete(null);
    }
  };

  const filteredDashboards = dashboards.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dashboard.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const header = (
    <header className="ws-header">
      <div>
        <h1 className="ws-title">Dashboards</h1>
        <p className="ws-subtitle">Group your charts into views you can share and embed.</p>
      </div>
      <div className="ws-actions">
        <GradientButton onClick={handleCreateDashboard} className="ws-primary-btn">
          <Plus className="w-4 h-4" />
          New dashboard
        </GradientButton>
      </div>
    </header>
  );

  if (isLoading) {
    return (
      <div className="min-h-full">
        <div className="ws-page">
          {header}
          <SkeletonGrid count={6} variant="dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="ws-page">
        {header}

        {dashboards.length === 0 ? (
          <div className="ws-empty">
            <span className="ws-empty-icon">
              <LayoutDashboard className="w-7 h-7" aria-hidden="true" />
            </span>
            <p className="ws-empty-title">No dashboards yet</p>
            <p className="ws-empty-text">
              Create a dashboard, then pin charts to it from the Charts page or the AI assistant.
            </p>
            <GradientButton onClick={handleCreateDashboard} className="ws-primary-btn">
              <Plus className="w-4 h-4" />
              Create your first dashboard
            </GradientButton>
          </div>
        ) : (
          <section className="ws-section">
            <div className="ws-section-head">
              <h2 className="ws-section-title">
                All dashboards
                <span className="ws-count">{filteredDashboards.length}</span>
              </h2>
              <div className="ws-toolbar">
                <label className="ws-search">
                  <Search aria-hidden="true" />
                  <span className="sr-only">Search dashboards</span>
                  <Input
                    placeholder="Search dashboards"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </label>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
            </div>

            {filteredDashboards.length === 0 ? (
              <div className="ws-empty">
                <p className="ws-empty-title">No dashboards match "{searchQuery}"</p>
                <p className="ws-empty-text">Try a different name or clear the search.</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="ws-grid">
                {filteredDashboards.map((dashboard) => (
                  <DashboardCard
                    key={dashboard.id}
                    dashboard={dashboard}
                    viewMode="grid"
                    onDelete={(e) => {
                      e.stopPropagation();
                      setDashboardToDelete(dashboard);
                    }}
                    onClick={() => onViewDashboard?.(dashboard.name, dashboard.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="ws-dash-list">
                {filteredDashboards.map((dashboard) => (
                  <DashboardCard
                    key={dashboard.id}
                    dashboard={dashboard}
                    viewMode="list"
                    onDelete={(e) => {
                      e.stopPropagation();
                      setDashboardToDelete(dashboard);
                    }}
                    onClick={() => onViewDashboard?.(dashboard.name, dashboard.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!dashboardToDelete} onOpenChange={() => setDashboardToDelete(null)}>
          <AlertDialogContent className="border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{dashboardToDelete?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This also removes the charts placed on it. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDashboard}
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
