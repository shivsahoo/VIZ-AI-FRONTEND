import React from "react";
import { LayoutDashboard, Lightbulb, BarChart3, Database, Users, Home, Sparkles, Activity, BookOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Separator } from "../ui/separator";

interface WorkspaceSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAIAssistant?: () => void;
  disabled?: boolean;
}

export function WorkspaceSidebar({ activeTab, onTabChange, onOpenAIAssistant, disabled = false }: WorkspaceSidebarProps) {
  const workspaceNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'charts', label: 'Charts', icon: BarChart3 },
    { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'observability', label: 'Observability', icon: Activity },
  ];

  const bottomNavItems = [
    { id: 'databases', label: 'Databases', icon: Database },
    { id: 'ontology', label: 'Data Ontology Explorer', icon: BookOpen },
    { id: 'team', label: 'Team', icon: Users },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="w-20 h-full bg-card/50 backdrop-blur-xl border-r border-border flex flex-col items-center py-6 nav-shadow">
        {/* Top Navigation Items */}
        <div className="flex flex-col items-center gap-3">
          {workspaceNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    id={item.id === 'charts' ? 'tour-sidebar-charts' : item.id === 'dashboards' ? 'tour-sidebar-dashboard' : undefined}
                    onClick={() => !disabled && onTabChange(item.id)}
                    disabled={disabled}
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center transition-smooth relative group
                      ${disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                          ? 'bg-primary/15 text-primary shadow-lg shadow-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${isActive && !disabled ? 'scale-110' : ''} transition-transform`} />
                    {isActive && !disabled && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 gradient-primary rounded-r-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="card-shadow-lg">
                  <p>{disabled ? 'Generating insights…' : item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom Navigation Items */}
        <div className="flex flex-col items-center gap-3">
          <Separator className="w-10 mb-1" />

          {/* Ask VizAI Button */}
          {/* {onOpenAIAssistant && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onOpenAIAssistant}
                  className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center transition-smooth hover:shadow-xl hover:shadow-primary/30 hover:scale-110 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <Sparkles className="w-5 h-5 text-white relative z-10" />
                  <div className="absolute inset-0 rounded-xl animate-pulse-glow" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="card-shadow-lg">
                <p>Ask VizAI</p>
              </TooltipContent>
            </Tooltip>
          )} */}

          <Separator className="w-10 my-1" />

          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => !disabled && onTabChange(item.id)}
                    disabled={disabled}
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center transition-smooth relative group
                      ${disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                          ? 'bg-primary/15 text-primary shadow-lg shadow-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${isActive && !disabled ? 'scale-110' : ''} transition-transform`} />
                    {isActive && !disabled && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 gradient-primary rounded-r-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="card-shadow-lg">
                  <p>{disabled ? 'Generating insights…' : item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
