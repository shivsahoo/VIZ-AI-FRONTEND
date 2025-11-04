import { useState, useEffect } from "react";
import { Plus, LayoutDashboard, Search, Grid3x3, List } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { DashboardCreationBot } from "../components/features/dashboards/DashboardCreationBot";
import { DashboardCard } from "../components/features/dashboards/DashboardCard";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
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
  id: number;
  name: string;
  description: string;
  charts: number;
  lastUpdated: string;
  category?: string;
  icon: any;
  createdById?: number;
  projectId?: number;
  status?: 'active' | 'archived';
  collaborators?: number;
}

interface DashboardsViewProps {
  dashboards: Dashboard[];
  onViewDashboard?: (dashboardName: string) => void;
  onCreateDashboard?: () => void;
}

export function DashboardsView({ dashboards, onViewDashboard, onCreateDashboard }: DashboardsViewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateDashboard = () => {
    setIsCreateDialogOpen(true);
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="p-5 border-border">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-5 bg-muted/50 rounded animate-pulse w-3/4" />
                      <div className="h-4 bg-muted/30 rounded animate-pulse w-full" />
                      <div className="h-4 bg-muted/30 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <div className="h-4 bg-muted/30 rounded animate-pulse w-1/2" />
                  </div>
                  <div className="h-4 bg-muted/30 rounded animate-pulse w-1/3" />
                </div>
              </Card>
            ))}
          </div>
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
            <Button
              onClick={handleCreateDashboard}
              size="sm"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white h-9"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Create Dashboard
            </Button>
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
                  <Button
                    onClick={handleCreateDashboard}
                    size="sm"
                    className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Dashboard
                  </Button>
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
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={`h-9 w-9 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={`h-9 w-9 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDashboards.map((dashboard) => (
                <DashboardCard
                  key={dashboard.id}
                  dashboard={dashboard}
                  viewMode="grid"
                  onDelete={(e) => {
                    e.stopPropagation();
                    setDashboardToDelete(dashboard);
                  }}
                  onClick={() => onViewDashboard?.(dashboard.name)}
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
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('grid')}
                  className={`h-9 w-9 ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  <Grid3x3 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => setViewMode('list')}
                  className={`h-9 w-9 ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
                >
                  <List className="w-4 h-4" />
                </Button>
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
                    onClick={() => onViewDashboard?.(dashboard.name)}
                  />
                ))}
              </div>
            </Card>
          </>
        )}

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
              onClose={() => {
                setIsCreateDialogOpen(false);
              }}
              onCreate={(name, description) => {
                toast.success(`Dashboard "${name}" created successfully!`);
                setIsCreateDialogOpen(false);
                onCreateDashboard?.();
              }}
            />
          </DialogContent>
        </Dialog>

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
