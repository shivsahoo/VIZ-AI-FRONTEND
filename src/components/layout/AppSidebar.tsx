import type { ReactNode } from "react";
import { motion } from "motion/react";
import {
  Activity,
  BarChart3,
  BookOpen,
  ChevronsUpDown,
  Database,
  Home,
  LayoutDashboard,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { initialsFor, toneFor } from "../shared/tone";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  tourId?: string;
}

const WORKSPACE_ITEMS: NavItem[] = [
  { id: "home", label: "Overview", icon: Home },
  { id: "charts", label: "Charts", icon: BarChart3, tourId: "tour-sidebar-charts" },
  { id: "dashboards", label: "Dashboards", icon: LayoutDashboard, tourId: "tour-sidebar-dashboard" },
  { id: "insights", label: "Insights", icon: Lightbulb },
  { id: "observability", label: "Observability", icon: Activity },
];

const DATA_ITEMS: NavItem[] = [
  { id: "databases", label: "Databases", icon: Database },
  { id: "ontology", label: "Data Ontology", icon: BookOpen },
  { id: "team", label: "Team", icon: Users },
];

const GLOBAL_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "profile", label: "Profile", icon: UserRound },
];

interface AppSidebarProps {
  mode: "home" | "workspace";
  /** Active workspace tab, or the active global view ("home" | "profile"). */
  activeId: string;
  onWorkspaceTabChange: (tab: string) => void;
  onNavigate: (view: string) => void;
  projects: Array<{ id: string; name: string }>;
  selectedProject: string | null;
  onProjectChange: (projectName: string) => void;
  onProjectOpen: (projectName: string, projectId: string) => void;
  onOpenAIAssistant?: () => void;
  disabled?: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function AppSidebar({
  mode,
  activeId,
  onWorkspaceTabChange,
  onNavigate,
  projects,
  selectedProject,
  onProjectChange,
  onProjectOpen,
  onOpenAIAssistant,
  disabled = false,
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const go = (fn: () => void) => () => {
    fn();
    onCloseMobile();
  };

  const renderItem = (item: NavItem, onSelect: () => void, isActive: boolean) => (
    <NavButton
      key={item.id}
      id={item.tourId}
      label={disabled && mode === "workspace" ? "Generating insights…" : item.label}
      icon={<item.icon size={20} strokeWidth={1.8} />}
      active={isActive}
      collapsed={collapsed}
      disabled={disabled && mode === "workspace"}
      onClick={go(onSelect)}
    />
  );

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className={`app-scrim${mobileOpen ? " is-visible" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`app-sidebar${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="app-sidebar-head">
          <button type="button" className="app-brand" onClick={go(() => onNavigate("home"))} aria-label="VizAI home">
            <img src="/favicon.svg" alt="" width={36} height={36} />
            <span className="app-brand-name">VizAI</span>
          </button>
          <button
            type="button"
            className="app-sidebar-icon-btn app-collapse-btn"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button
            type="button"
            className="app-sidebar-icon-btn app-close-btn"
            onClick={onCloseMobile}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        {mode === "workspace" && selectedProject && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="app-project-switch" aria-label={`Switch product, current: ${selectedProject}`}>
                <span className={`app-tile tone-${toneFor(selectedProject)}`}>{initialsFor(selectedProject)}</span>
                <span className="app-project-switch-text">
                  <span className="app-project-switch-label">Product</span>
                  <span className="app-project-switch-name">{selectedProject}</span>
                </span>
                <ChevronsUpDown size={16} className="app-project-switch-chevron" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-64">
              <DropdownMenuItem onClick={go(() => onNavigate("home"))} className="gap-2.5 py-2.5">
                <Home className="w-4 h-4" />
                All products
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Switch to</DropdownMenuLabel>
              {projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={go(() => onProjectChange(p.name))}
                  className={`gap-2.5 py-2 ${p.name === selectedProject ? "bg-muted" : ""}`}
                >
                  <span className={`app-tile app-tile--xs tone-${toneFor(p.name)}`}>{initialsFor(p.name)}</span>
                  <span className="truncate">{p.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <nav className="app-nav">
          {mode === "workspace" ? (
            <>
              <NavSection label="Workspace" collapsed={collapsed}>
                {WORKSPACE_ITEMS.map((item) =>
                  renderItem(item, () => onWorkspaceTabChange(item.id), activeId === item.id)
                )}
              </NavSection>
              <NavSection label="Data" collapsed={collapsed}>
                {DATA_ITEMS.map((item) => renderItem(item, () => onWorkspaceTabChange(item.id), activeId === item.id))}
              </NavSection>
            </>
          ) : (
            <>
              <NavSection label="Menu" collapsed={collapsed}>
                {GLOBAL_ITEMS.map((item) => renderItem(item, () => onNavigate(item.id), activeId === item.id))}
              </NavSection>
              {projects.length > 0 && (
                <NavSection label="Products" collapsed={collapsed}>
                  {projects.slice(0, 8).map((p) => (
                    <NavButton
                      key={p.id}
                      label={p.name}
                      icon={<span className={`app-tile app-tile--sm tone-${toneFor(p.name)}`}>{initialsFor(p.name)}</span>}
                      active={false}
                      collapsed={collapsed}
                      onClick={go(() => onProjectOpen(p.name, p.id))}
                    />
                  ))}
                </NavSection>
              )}
            </>
          )}
        </nav>

        {onOpenAIAssistant && (
          <div className="app-ask">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="app-ask-fab" onClick={go(onOpenAIAssistant)} aria-label="Ask VizAI">
                    <Sparkles size={20} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Ask VizAI</TooltipContent>
              </Tooltip>
            ) : (
              <motion.div
                className="app-ask-card"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.28, 0.11, 0.32, 1] }}
              >
                <span className="app-ask-icon">
                  <Sparkles size={18} />
                </span>
                <p className="app-ask-title">Ask VizAI</p>
                <p className="app-ask-text">Type a question, get a chart you can pin to a dashboard.</p>
                <button type="button" className="app-ask-btn" onClick={go(onOpenAIAssistant)}>
                  Ask a question
                </button>
              </motion.div>
            )}
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}

function NavSection({ label, collapsed, children }: { label: string; collapsed: boolean; children: ReactNode }) {
  return (
    <div className="app-nav-section">
      {collapsed ? <div className="app-nav-divider" /> : <p className="app-nav-label">{label}</p>}
      <div className="app-nav-items">{children}</div>
    </div>
  );
}

function NavButton({
  id,
  label,
  icon,
  active,
  collapsed,
  disabled,
  onClick,
}: {
  id?: string;
  label: string;
  icon: ReactNode;
  active: boolean;
  collapsed: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const button = (
    <button
      id={id}
      type="button"
      className={`app-nav-item${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
    >
      {active && (
        <motion.span
          layoutId="app-nav-active"
          className="app-nav-active"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <span className="app-nav-icon">{icon}</span>
      <span className="app-nav-text">{label}</span>
    </button>
  );

  if (!collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}
