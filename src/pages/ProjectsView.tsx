import { useState, useEffect } from "react";
import { Plus, Database, LayoutDashboard, TrendingUp, Clock, Users as UsersIcon, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { GradientButton } from "../components/shared/GradientButton";
import { OnboardingFlow } from "./OnboardingFlow";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { KPIInfoBot } from "../components/features/ai/KPIInfoBot";
import { toast } from "sonner";
import { getProjects, createProject, getCurrentUser, type Project as ApiProject } from "../services/api";

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

// Helper function to get gradient colors based on index
const getProjectGradient = (index: number): { gradient: string; iconBg: string } => {
  const gradients = [
    { gradient: "from-blue-500/10 to-cyan-500/10", iconBg: "from-blue-500 to-cyan-500" },
    { gradient: "from-purple-500/10 to-pink-500/10", iconBg: "from-purple-500 to-pink-500" },
    { gradient: "from-emerald-500/10 to-teal-500/10", iconBg: "from-emerald-500 to-teal-500" },
    { gradient: "from-orange-500/10 to-red-500/10", iconBg: "from-orange-500 to-red-500" },
    { gradient: "from-indigo-500/10 to-purple-500/10", iconBg: "from-indigo-500 to-purple-500" },
    { gradient: "from-rose-500/10 to-pink-500/10", iconBg: "from-rose-500 to-pink-500" },
  ];
  return gradients[index % gradients.length];
};

// UI Project type (extends API Project with display fields)
interface UIProject extends ApiProject {
  dashboards?: number;
  databases?: number;
  team?: number;
  lastActive?: string;
  gradient: string;
  iconBg: string;
}

interface ProjectsViewProps {
  onProjectSelect: (projectName: string, projectId?: string) => void;
}

export function ProjectsView({ onProjectSelect }: ProjectsViewProps) {
  const [showNewProjectFlow, setShowNewProjectFlow] = useState(false);
  const [showKPICollection, setShowKPICollection] = useState(false);
  const [projects, setProjects] = useState<UIProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [pendingProjectData, setPendingProjectData] = useState<{
    projectId: string;
    projectName: string;
    projectDescription?: string;
    projectDomain?: string;
    enhancedDescription?: string;
  } | null>(null);

  // Fetch projects and user ID on mount
  useEffect(() => {
    fetchProjects();
    fetchUserId();
  }, []);

  const fetchUserId = async () => {
    try {
      const response = await getCurrentUser();
      if (response.success && response.data) {
        setCurrentUserId(response.data.id);
      }
    } catch (error) {
      console.error("Failed to get user ID:", error);
    }
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProjects();
      if (response.success && response.data) {
        // Map API projects to UI format
        const uiProjects: UIProject[] = response.data.map((project, index) => {
          const colors = getProjectGradient(index);
          return {
            ...project,
            dashboards: project.dashboardCount || 0,
            databases: project.databaseCount || 0,
            team: project.memberCount || 0,
            lastActive: formatTimeAgo(project.createdAt),
            gradient: colors.gradient,
            iconBg: colors.iconBg,
          };
        });
        setProjects(uiProjects);
      } else {
        setError(response.error?.message || "Failed to fetch projects");
        toast.error(response.error?.message || "Failed to load projects");
      }
    } catch (err: any) {
      const errorMessage = err.message || "An error occurred while fetching projects";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewProjectComplete = async (projectData: {
    name: string;
    description: string;
    context: Record<string, string>;
    database: any;
  }) => {
    try {
      // Create project via API with enhanced description if available
      const description = projectData.context?.enhanced_description || projectData.description;
      const response = await createProject({
        name: projectData.name,
        description: description,
      });

      if (response.success && response.data) {
        toast.success(`Project "${projectData.name}" created successfully!`);
        
        // Add new project to list with UI formatting
        const colors = getProjectGradient(projects.length);
        const newProject: UIProject = {
          ...response.data,
          dashboards: 0,
          databases: 0,
          team: 1,
          lastActive: "just now",
          gradient: colors.gradient,
          iconBg: colors.iconBg,
        };
        setProjects([newProject, ...projects]);
        
        // Store project data for KPI collection
        setPendingProjectData({
          projectId: response.data.id,
          projectName: projectData.name,
          projectDescription: projectData.description,
          projectDomain: projectData.context?.domain,
          enhancedDescription: projectData.context?.enhanced_description,
        });

        // Show KPI collection flow
        setShowNewProjectFlow(false);
        setShowKPICollection(true);
      } else {
        toast.error(response.error?.message || "Failed to create project");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred while creating project");
    }
  };

  const handleKPICollectionComplete = (data: {
    kpis: string[];
    kpisSummary: string;
  }) => {
    // KPI collection complete - you can save KPIs to project if needed
    console.log("KPIs collected:", data);
    toast.success("KPIs collected successfully!");
    
    // Close KPI collection and select the project
    setShowKPICollection(false);
    if (pendingProjectData) {
      onProjectSelect(pendingProjectData.projectName, pendingProjectData.projectId);
    }
    setPendingProjectData(null);
  };

  const handleKPICollectionCancel = () => {
    // Skip KPI collection and select the project
    setShowKPICollection(false);
    if (pendingProjectData) {
      onProjectSelect(pendingProjectData.projectName, pendingProjectData.projectId);
    }
    setPendingProjectData(null);
  };

  const handleNewProjectCancel = () => {
    setShowNewProjectFlow(false);
  };

  // Calculate stats from real data
  const stats = [
    { 
      label: "Total Projects", 
      value: projects.length.toString(), 
      icon: LayoutDashboard 
    },
    { 
      label: "Active Dashboards", 
      value: projects.reduce((sum, p) => sum + (p.dashboards || 0), 0).toString(), 
      icon: TrendingUp 
    },
    { 
      label: "Data Sources", 
      value: projects.reduce((sum, p) => sum + (p.databases || 0), 0).toString(), 
      icon: Database 
    },
    { 
      label: "Team Members", 
      value: projects.reduce((sum, p) => sum + (p.team || 0), 0).toString(), 
      icon: UsersIcon 
    }
  ];

  // If creating a new project, show the full onboarding flow
  if (showNewProjectFlow) {
    return (
      <div className="min-h-full bg-background">
        <OnboardingFlow 
          onComplete={handleNewProjectComplete} 
          onCancel={handleNewProjectCancel}
        />
      </div>
    );
  }

  // If collecting KPIs, show KPI collection flow
  if (showKPICollection && pendingProjectData && currentUserId) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-3xl">
          <KPIInfoBot
            userId={currentUserId}
            projectName={pendingProjectData.projectName}
            projectDescription={pendingProjectData.projectDescription}
            projectDomain={pendingProjectData.projectDomain}
            productDescription={pendingProjectData.enhancedDescription}
            onComplete={handleKPICollectionComplete}
            onCancel={handleKPICollectionCancel}
          />
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading projects..." />
      </div>
    );
  }

  // Show error state
  if (error && projects.length === 0) {
    return (
      <div className="min-h-full bg-background flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-foreground mb-2">Failed to Load Projects</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchProjects}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden border-b border-border bg-muted/30">
        <div className="absolute inset-0 bg-grid-pattern opacity-30"></div>
        <div className="relative px-8 py-12 max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl text-foreground mb-2">Welcome back!</h1>
            <p className="text-muted-foreground text-lg">Continue where you left off</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-4 border border-border bg-card hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl text-foreground">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {/* Projects Section */}
      <div className="px-8 py-12 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl text-foreground mb-1">Your Products</h2>
            <p className="text-muted-foreground">Select a product to view analytics and insights</p>
          </div>
          <GradientButton 
            onClick={() => setShowNewProjectFlow(true)}
            className="shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Product
          </GradientButton>
        </div>

        {/* Projects Grid */}
        {projects.length === 0 ? (
          <Card className="p-12 text-center border border-border">
            <LayoutDashboard className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold text-foreground mb-2">No projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first project to get started</p>
            <GradientButton onClick={() => setShowNewProjectFlow(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Project
            </GradientButton>
          </Card>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.map((project) => (
            <Card 
              key={project.id}
              className="group relative overflow-hidden border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300 cursor-pointer bg-card"
                onClick={() => onProjectSelect(project.name, project.id)}
            >
              <div className="p-6">
                {/* Icon & Title */}
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${project.iconBg} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <LayoutDashboard className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg text-foreground mb-1 group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        {project.description || "No description"}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 py-3 px-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <LayoutDashboard className="w-4 h-4" />
                      <span>{project.dashboards || 0}</span>
                  </div>
                  <div className="w-px h-4 bg-border"></div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Database className="w-4 h-4" />
                      <span>{project.databases || 0}</span>
                  </div>
                  <div className="w-px h-4 bg-border"></div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <UsersIcon className="w-4 h-4" />
                      <span>{project.team || 0}</span>
                  </div>
                  <div className="flex-1"></div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                      <span>{project.lastActive || "Unknown"}</span>
                  </div>
                </div>
              </div>

              {/* Subtle gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
            </Card>
          ))}
        </div>
        )}

      </div>
    </div>
  );
}
