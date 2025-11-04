import { useState } from "react";
import { Plus, Database, LayoutDashboard, TrendingUp, Sparkles, Clock, Users as UsersIcon, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { OnboardingFlow } from "./OnboardingFlow";
import { toast } from "sonner";

const mockProjects = [
  {
    id: 1,
    name: "E-Commerce Analytics",
    description: "Customer behavior and sales performance tracking",
    dashboards: 12,
    databases: 3,
    team: 8,
    lastActive: "2 hours ago",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconBg: "from-blue-500 to-cyan-500"
  },
  {
    id: 2,
    name: "Marketing Intelligence",
    description: "Campaign performance and ROI analysis",
    dashboards: 8,
    databases: 2,
    team: 5,
    lastActive: "5 hours ago",
    gradient: "from-purple-500/10 to-pink-500/10",
    iconBg: "from-purple-500 to-pink-500"
  },
  {
    id: 3,
    name: "Financial Reporting",
    description: "Revenue metrics and financial forecasting",
    dashboards: 15,
    databases: 4,
    team: 12,
    lastActive: "1 day ago",
    gradient: "from-emerald-500/10 to-teal-500/10",
    iconBg: "from-emerald-500 to-teal-500"
  },
  {
    id: 4,
    name: "Product Analytics",
    description: "User engagement and feature adoption metrics",
    dashboards: 10,
    databases: 2,
    team: 6,
    lastActive: "3 hours ago",
    gradient: "from-orange-500/10 to-red-500/10",
    iconBg: "from-orange-500 to-red-500"
  }
];

const stats = [
  { label: "Total Projects", value: "4", icon: LayoutDashboard },
  { label: "Active Dashboards", value: "45", icon: TrendingUp },
  { label: "Data Sources", value: "11", icon: Database },
  { label: "Team Members", value: "31", icon: UsersIcon }
];

interface ProjectsViewProps {
  onProjectSelect: (projectName: string) => void;
}

export function ProjectsView({ onProjectSelect }: ProjectsViewProps) {
  const [showNewProjectFlow, setShowNewProjectFlow] = useState(false);

  const handleNewProjectComplete = (projectData: {
    name: string;
    description: string;
    context: Record<string, string>;
    database: any;
  }) => {
    setShowNewProjectFlow(false);
    toast.success(`Project "${projectData.name}" created successfully!`);
    // Automatically select the newly created project
    onProjectSelect(projectData.name);
  };

  // If creating a new project, show the full onboarding flow
  if (showNewProjectFlow) {
    return (
      <div className="min-h-full bg-background">
        <OnboardingFlow onComplete={handleNewProjectComplete} />
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
            <h2 className="text-2xl text-foreground mb-1">Your Projects</h2>
            <p className="text-muted-foreground">Select a project to view analytics and insights</p>
          </div>
          <Button 
            onClick={() => setShowNewProjectFlow(true)}
            className="bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mockProjects.map((project) => (
            <Card 
              key={project.id}
              className="group relative overflow-hidden border border-border hover:border-primary/30 hover:shadow-xl transition-all duration-300 cursor-pointer bg-card"
              onClick={() => onProjectSelect(project.name)}
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
                      {project.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 py-3 px-4 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>{project.dashboards}</span>
                  </div>
                  <div className="w-px h-4 bg-border"></div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Database className="w-4 h-4" />
                    <span>{project.databases}</span>
                  </div>
                  <div className="w-px h-4 bg-border"></div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <UsersIcon className="w-4 h-4" />
                    <span>{project.team}</span>
                  </div>
                  <div className="flex-1"></div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{project.lastActive}</span>
                  </div>
                </div>
              </div>

              {/* Subtle gradient background on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br ${project.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}></div>
            </Card>
          ))}
        </div>

      </div>
    </div>
  );
}
