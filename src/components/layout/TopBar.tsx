import { AnimatePresence, motion } from "motion/react";
import { ChevronRight, LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { initialsFor } from "../shared/tone";

interface TopBarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  selectedProject?: string | null;
  workspaceTab?: string;
  user: {
    name: string;
    email: string;
  };
  onSignOut: () => void;
  isDark: boolean;
  onThemeToggle: () => void;
  onOpenMobileNav: () => void;
}

const TAB_LABELS: Record<string, string> = {
  home: "Overview",
  charts: "Charts",
  dashboards: "Dashboards",
  databases: "Databases",
  insights: "Insights",
  observability: "Observability",
  ontology: "Data Ontology",
  team: "Team",
};

export function TopBar({
  currentView,
  onNavigate,
  selectedProject,
  workspaceTab,
  user,
  onSignOut,
  isDark,
  onThemeToggle,
  onOpenMobileNav,
}: TopBarProps) {
  const inWorkspace = currentView === "workspace" && selectedProject;
  const tabLabel = workspaceTab ? TAB_LABELS[workspaceTab] ?? workspaceTab : null;

  return (
    <header className="app-header">
      <button type="button" className="app-round-btn app-menu-btn" onClick={onOpenMobileNav} aria-label="Open navigation">
        <Menu size={18} />
      </button>

      <div className="app-header-context">
        {inWorkspace && (
          <nav aria-label="Breadcrumb" className="app-crumbs">
            <button type="button" className="app-crumb-link" onClick={() => onNavigate("home")}>
              Products
            </button>
            <ChevronRight size={14} aria-hidden="true" className="app-crumb-sep" />
            <span className="app-crumb-muted">{selectedProject}</span>
            {tabLabel && (
              <>
                <ChevronRight size={14} aria-hidden="true" className="app-crumb-sep" />
                <span className="app-crumb-current" aria-current="page">
                  {tabLabel}
                </span>
              </>
            )}
          </nav>
        )}
      </div>

      <div className="app-header-actions">
        <button
          type="button"
          className="app-round-btn"
          onClick={onThemeToggle}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={isDark ? "sun" : "moon"}
              initial={{ opacity: 0, rotate: -90, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 90, scale: 0.6 }}
              transition={{ duration: 0.2 }}
              style={{ display: "grid" }}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </motion.span>
          </AnimatePresence>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="app-avatar-btn" aria-label={`Account menu for ${user.name}`}>
              <span className="app-avatar">{initialsFor(user.name)}</span>
              <span className="app-avatar-name">{user.name}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-3 px-3 py-3">
              <span className="app-avatar">{initialsFor(user.name)}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNavigate("profile")} className="gap-2.5 py-2.5">
              <UserRound className="w-4 h-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onSignOut} className="gap-2.5 py-2.5 text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
