import { useState } from "react";
import { motion } from "motion/react";
import { Bot, LayoutDashboard, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../ui/utils";
import { DashboardCreationForm } from "./DashboardCreationForm";
import { AutopilotDashboardForm } from "./AutopilotDashboardForm";

type DashboardMode = "select" | "manual" | "autopilot";

interface DashboardTypeSelectionModalProps {
  projectId: string;
  onComplete: (data: {
    name: string;
    description: string;
    dashboardId: string;
    isAutopilot?: boolean;
    kpiGoals?: string;
    connectionId?: string;
  }) => void;
  onCancel?: () => void;
}

export function DashboardTypeSelectionModal({
  projectId,
  onComplete,
  onCancel,
}: DashboardTypeSelectionModalProps) {
  const [mode, setMode] = useState<DashboardMode>("select");

  if (mode === "manual") {
    return (
      <DashboardCreationForm
        projectId={projectId}
        onComplete={(data) => onComplete({ ...data, isAutopilot: false })}
        onCancel={() => setMode("select")}
      />
    );
  }

  if (mode === "autopilot") {
    return (
      <AutopilotDashboardForm
        projectId={projectId}
        onComplete={(data) => onComplete({ ...data, isAutopilot: true })}
        onCancel={() => setMode("select")}
      />
    );
  }

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-semibold">Create New Dashboard</h3>
            <p className="text-xs text-muted-foreground">
              Choose how you'd like to build your dashboard
            </p>
          </div>
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Mode Selection Cards */}
      <div className="px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Autopilot Dashboard */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            onClick={() => setMode("autopilot")}
            className={cn(
              "group relative flex flex-col items-start text-left rounded-xl border-2 p-6 transition-all duration-200",
              "border-primary/30 hover:border-primary/70 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent",
              "hover:shadow-lg hover:shadow-primary/10 cursor-pointer"
            )}
          >
            {/* Badge */}
            <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-white shadow-sm">
              Recommended
            </span>

            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md mb-4 group-hover:scale-105 transition-transform duration-200">
              <Sparkles className="w-6 h-6 text-white" />
            </div>

            <h4 className="text-foreground font-semibold text-base mb-1.5">Autopilot Dashboard</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Describe the KPIs you want to monitor. AI instantly builds a full dashboard with 5–6 relevant charts.
            </p>

            <ul className="space-y-1.5 text-xs text-muted-foreground mb-5">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                5–6 AI-generated charts
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                Probe Mode on every chart
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                Ready in seconds
              </li>
            </ul>

            <div className="flex items-center gap-1.5 text-primary text-sm font-medium group-hover:gap-2.5 transition-all">
              Get started
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.button>

          {/* Manual Dashboard */}
          <motion.button
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            onClick={() => setMode("manual")}
            className={cn(
              "group flex flex-col items-start text-left rounded-xl border-2 p-6 transition-all duration-200",
              "border-border hover:border-muted-foreground/40 bg-card",
              "hover:shadow-md cursor-pointer"
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shadow-sm mb-4 group-hover:scale-105 transition-transform duration-200">
              <Bot className="w-6 h-6 text-muted-foreground" />
            </div>

            <h4 className="text-foreground font-semibold text-base mb-1.5">Manual Dashboard</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Start with a blank dashboard and build it your way using the AI Assistant or Charts view.
            </p>

            <ul className="space-y-1.5 text-xs text-muted-foreground mb-5">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                Full creative control
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                Add charts one by one
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground flex-shrink-0" />
                Use AI Assistant anytime
              </li>
            </ul>

            <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium group-hover:gap-2.5 transition-all">
              Create blank
              <ArrowRight className="w-4 h-4" />
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
