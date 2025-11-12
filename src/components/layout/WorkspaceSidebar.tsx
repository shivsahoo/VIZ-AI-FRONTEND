import React from "react";
import { LayoutDashboard, Lightbulb, BarChart3, Database, Users, Home, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Separator } from "../ui/separator";

interface WorkspaceSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenAIAssistant?: () => void;
}

export function WorkspaceSidebar({ activeTab, onTabChange, onOpenAIAssistant }: WorkspaceSidebarProps) {
  const workspaceNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'charts', label: 'Charts', icon: BarChart3 },
    { id: 'dashboards', label: 'Dashboards', icon: LayoutDashboard },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
  ];

  const bottomNavItems = [
    { id: 'databases', label: 'Databases', icon: Database },
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
                    onClick={() => onTabChange(item.id)}
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center transition-smooth relative group
                      ${isActive 
                        ? 'bg-primary/15 text-primary shadow-lg shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 gradient-primary rounded-r-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="card-shadow-lg">
                  <p>{item.label}</p>
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
          {onOpenAIAssistant && (
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
          )}

          <Separator className="w-10 my-1" />

          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onTabChange(item.id)}
                    className={`
                      w-12 h-12 rounded-xl flex items-center justify-center transition-smooth relative group
                      ${isActive 
                        ? 'bg-primary/15 text-primary shadow-lg shadow-primary/20' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 gradient-primary rounded-r-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="card-shadow-lg">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
