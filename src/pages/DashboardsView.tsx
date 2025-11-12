import { useState, useEffect } from "react";
import { Plus, LayoutDashboard, Search } from "lucide-react";
import { Card } from "../components/ui/card";
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
  isLoading?: boolean;
}

export function DashboardsView({ dashboards, onViewDashboard, onCreateDashboard, isLoading: externalIsLoading }: DashboardsViewProps) {
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
      toast.success(`"${dashboardToDelete.name}" deleted successfully`);
      setDashboardToDelete(null);
    }
  };

  const filteredDashboards = dashboards.filter(dashboard =>
    dashboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dashboard.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-full bg-background">
        <div className="max-w-[2000px] mx-auto px-6 py-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground">Dashboards</h1>
              <p className="text-muted-foreground mt-0.5">
                Manage and organize your analytics dashboards
              </p>
            </div>
            {/* Skeleton for buttons */}
            <div className="flex items-center gap-3 opacity-50">
              <div className="w-9 h-9 bg-muted/50 rounded-md animate-pulse" />
              <div className="w-9 h-9 bg-muted/50 rounded-md animate-pulse" />
              <div className="w-36 h-9 bg-muted/50 rounded-md animate-pulse" />
            </div>
          </div>

          {/* Skeleton grid */}
          <SkeletonGrid count={6} variant="dashboard" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-background">
      <div className="max-w-[2000px] mx-auto px-6 py-5 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-foreground">Dashboards</h1>
            <p className="text-muted-foreground mt-0.5">
              Manage and organize your analytics dashboards
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GradientButton
              onClick={handleCreateDashboard}
              size="sm"
              className="h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Dashboard
            </GradientButton>
          </div>
        </div>

        {/* Dashboards Grid/List */}
        {filteredDashboards.length === 0 ? (
          <Card className="border-border p-12">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <LayoutDashboard className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-foreground mb-2">No dashboards found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery ? "Try adjusting your search" : "Create your first dashboard to get started"}
                </p>
                {!searchQuery && (
                  <GradientButton
                    onClick={handleCreateDashboard}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Dashboard
                  </GradientButton>
                )}
              </div>
            </div>
          </Card>
        ) : viewMode === 'grid' ? (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-foreground">All Dashboards</h2>
              <div className="flex items-center gap-2">
                <div className="relative max-w-xs flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search dashboards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 border-border text-sm"
                  />
                </div>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDashboards.map((dashboard) => (
                <DashboardCard
                  key={dashboard.id}
                  dashboard={dashboard}
                  viewMode={viewMode}
                  onDelete={(e) => {
                    e.stopPropagation();
                    setDashboardToDelete(dashboard);
                  }}
                  onClick={() => onViewDashboard?.(dashboard.name, dashboard.id)}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-foreground">All Dashboards</h2>
              <div className="flex items-center gap-2">
                <div className="relative max-w-xs flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search dashboards..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 border-border text-sm"
                  />
                </div>
                <ViewModeToggle value={viewMode} onChange={setViewMode} />
              </div>
            </div>
            <Card className="border-border overflow-hidden">
              <div className="divide-y divide-border">
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
            </Card>
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!dashboardToDelete} onOpenChange={() => setDashboardToDelete(null)}>
          <AlertDialogContent className="border-border">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{dashboardToDelete?.name}"? This will also remove all charts within this dashboard. This action cannot be undone.
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
