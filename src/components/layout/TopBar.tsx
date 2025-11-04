import React from "react";
import { Home, Sparkles, ChevronDown, LogOut } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Separator } from "../ui/separator";
import { ThemeToggle } from "../ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

interface Project {
  id: number;
  name: string;
}

interface TopBarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  selectedProject?: string | null;
  workspaceTab?: string;
  projects: Project[];
  onProjectChange: (projectName: string) => void;
  user: {
    name: string;
    email: string;
  };
  onSignOut: () => void;
  isDark: boolean;
  onThemeToggle: () => void;
}

export function TopBar({ 
  currentView, 
  onNavigate,
  selectedProject,
  workspaceTab,
  projects,
  onProjectChange,
  user,
  onSignOut,
  isDark,
  onThemeToggle
}: TopBarProps) {
  const isInWorkspace = currentView === 'workspace';

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const globalNavItems: { id: string; label: string; icon: any }[] = [];

  // Get workspace tab label
  const getTabLabel = () => {
    if (!workspaceTab) return null;
    
    const tabLabels: Record<string, string> = {
      home: 'Home',
      charts: 'Charts',
      dashboards: 'Dashboards',
      databases: 'Databases',
      insights: 'Insights',
      team: 'Team',
    };

    return tabLabels[workspaceTab];
  };

  return (
    <div className="h-16 border-b border-border bg-card/80 backdrop-blur-xl flex items-center px-8 gap-6 nav-shadow sticky top-0 z-50">
      {/* Logo */}
      <div 
        className="flex items-center gap-3 cursor-pointer shrink-0 group"
        onClick={() => onNavigate('home')}
      >
        <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-lg hover:shadow-xl transition-all hover:scale-105 animate-pulse-glow">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        {/* Only show VizAI text when NOT in workspace */}
        {!isInWorkspace && (
          <span className="text-xl text-foreground tracking-tight group-hover:text-primary transition-colors">VizAI</span>
        )}
      </div>

      {/* Project Selector (only in workspace) */}
      {isInWorkspace && selectedProject && (
        <div className="flex items-center gap-2.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="group h-10 px-4 gap-2.5 hover:bg-muted/50 rounded-lg transition-smooth"
              >
                <span className="text-foreground font-medium tracking-tight">{selectedProject}</span>
                <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 card-shadow-lg">
              <DropdownMenuItem
                onClick={() => onNavigate('home')}
                className="gap-2.5 py-2.5"
              >
                <Home className="w-4 h-4" />
                All Projects
              </DropdownMenuItem>
              <Separator className="my-1.5" />
              {projects.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  onClick={() => onProjectChange(project.name)}
                  className={`py-2.5 ${selectedProject === project.name ? 'bg-muted' : ''}`}
                >
                  {project.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {workspaceTab && (
            <>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-sm text-muted-foreground font-medium">{getTabLabel()}</span>
            </>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme Toggle */}
      <ThemeToggle isDark={isDark} onToggle={onThemeToggle} />

      {/* Profile Menu */}
      <Separator orientation="vertical" className="h-7" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 w-10 rounded-full p-0 hover:scale-105 transition-transform">
            <Avatar className="h-10 w-10 ring-2 ring-primary/10 hover:ring-primary/30 transition-all">
              <AvatarFallback className="gradient-primary text-white">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 card-shadow-lg">
          <div 
            className="group flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-muted/50 rounded-lg transition-smooth mx-1"
            onClick={() => onNavigate('profile')}
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback className="gradient-primary text-white">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0.5">
              <p className="text-foreground font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">{user.email}</p>
            </div>
          </div>
          <Separator className="my-2" />
          <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive py-2.5 mx-1">
            <LogOut className="w-4 h-4 mr-2.5" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
