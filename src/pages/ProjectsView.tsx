import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Database,
  Globe,
  LayoutDashboard,
  Loader2,
  Plus,
  Check,
  ChevronDown,
  Search,
  Trash2,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { OnboardingFlow } from "./OnboardingFlow";
import { toast } from "sonner";
import { getProjects, createProject, deleteProject, listApps, deleteApp, type Project as ApiProject, type AppDetail } from "../services/api";
import { CreateAppModal } from "../components/features/apps/CreateAppModal";
import { AskDemo } from "../components/shared/AskDemo";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { initialsFor, toneFor } from "../components/shared/tone";
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
import "./ProjectsView.css";

const EASE = [0.28, 0.11, 0.32, 1] as const;

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} h ago`;
  if (diffDays < 7) return `${diffDays} d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const greetingFor = (date: Date) => {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// UI Project type (extends API Project with display fields)
interface UIProject extends ApiProject {
  dashboards: number;
  databases: number;
  team: number;
  lastActive: string;
}

// Setup steps a product goes through: created → database connected → first dashboard.
const setupProgress = (p: UIProject) => {
  const done = 1 + (p.databases > 0 ? 1 : 0) + (p.dashboards > 0 ? 1 : 0);
  const next = p.databases === 0 ? "Connect a database" : p.dashboards === 0 ? "Create a dashboard" : null;
  return { pct: Math.round((done / 3) * 100), done, next };
};

interface ProjectsViewProps {
  onProjectSelect: (projectName: string, projectId?: string, isNewProject?: boolean) => void;
  onAskInProduct?: (projectName: string, projectId: string, question: string) => void;
  userName?: string;
}

const ASK_SUGGESTIONS = ["Top 10 by revenue", "Monthly trend this year", "Compare regions"];

export function ProjectsView({ onProjectSelect, onAskInProduct, userName }: ProjectsViewProps) {
  const [askProjectId, setAskProjectId] = useState<string | null>(null);
  const [askText, setAskText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [showNewProjectFlow, setShowNewProjectFlow] = useState(false);
  const [projects, setProjects] = useState<UIProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<UIProject | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // App registration state
  const [apps, setApps] = useState<AppDetail[]>([]);
  const [showCreateAppModal, setShowCreateAppModal] = useState(false);
  const [appToDelete, setAppToDelete] = useState<AppDetail | null>(null);
  const [isDeletingApp, setIsDeletingApp] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchApps();
  }, []);

  const fetchApps = async () => {
    try {
      const response = await listApps();
      if (response.success && response.data) {
        setApps(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch apps:", error);
    }
  };

  const handleConfirmDeleteApp = async () => {
    if (!appToDelete) return;
    setIsDeletingApp(true);
    try {
      const response = await deleteApp(appToDelete.app_id);
      if (response.success) {
        setApps((prev) => prev.filter((a) => a.app_id !== appToDelete.app_id));
        toast.success(`"${appToDelete.company_name}" removed`);
      } else {
        toast.error(response.error?.message || "Failed to delete app");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete app");
    } finally {
      setIsDeletingApp(false);
      setAppToDelete(null);
    }
  };

  const fetchProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProjects();
      if (response.success && response.data) {
        setProjects(
          response.data.map((project) => ({
            ...project,
            dashboards: project.dashboardCount || 0,
            databases: project.databaseCount || 0,
            team: project.memberCount || 0,
            lastActive: formatTimeAgo(project.createdAt),
          }))
        );
      } else {
        setError(response.error?.message || "Unable to load products. Please try again.");
      }
    } catch (err: any) {
      // Error message is already sanitized by apiRequest
      setError(err.message || "Unable to load products. Check your connection and try again.");
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
      // Check if project was already created in Step 1 (via WebSocket project_info workflow)
      const existingProjectId = projectData.context?.projectId;

      let projectId: string;
      let createdAt: string;

      if (existingProjectId) {
        projectId = existingProjectId;
        createdAt = new Date().toISOString();
      } else {
        // Fallback: Create project via API (shouldn't normally happen in the new flow)
        const description = projectData.context?.enhanced_description || projectData.description;
        const response = await createProject({
          name: projectData.name,
          description: description,
          primary_domain:
            projectData.context?.primary_domain ??
            projectData.context?.domain ??
            "Other",
          additional_kpis: projectData.context?.additional_kpis?.trim() || null,
        });

        if (!response.success || !response.data) {
          toast.error(response.error?.message || "Failed to create product");
          return;
        }

        projectId = response.data.id;
        createdAt = response.data.createdAt;
      }

      const newProject: UIProject = {
        id: projectId,
        name: projectData.name,
        description: projectData.context?.enhanced_description || projectData.description || '',
        createdAt: createdAt,
        updatedAt: createdAt,
        owner: '', // Will be populated by backend
        memberCount: 1,
        databaseCount: 0, // Database is connected later from Home/Databases
        dashboardCount: 0,
        dashboards: 0,
        databases: 0,
        team: 1,
        lastActive: "just now",
      };
      setProjects([newProject, ...projects]);
      setShowNewProjectFlow(false);
      toast.success(`"${projectData.name}" is ready`, { description: "Opening your workspace…" });

      setTimeout(() => {
        onProjectSelect(projectData.name, projectId, true); // true indicates this is a new project
      }, 500);
    } catch (err: any) {
      toast.error(err.message || "An error occurred while setting up the product");
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;

    setIsDeletingProject(true);
    try {
      const response = await deleteProject(projectToDelete.id);
      if (response.success) {
        setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
        toast.success(`"${projectToDelete.name}" deleted`);
      } else {
        toast.error(response.error?.message || "Failed to delete product");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete product");
    } finally {
      setIsDeletingProject(false);
      setProjectToDelete(null);
    }
  };

  const stats = useMemo(
    () => [
      { label: "Products", value: projects.length, icon: LayoutDashboard },
      { label: "Dashboards", value: projects.reduce((s, p) => s + p.dashboards, 0), icon: ArrowUpRight },
      { label: "Data sources", value: projects.reduce((s, p) => s + p.databases, 0), icon: Database },
      { label: "Team members", value: projects.reduce((s, p) => s + p.team, 0), icon: UsersIcon },
    ],
    [projects]
  );

  // Featured: the product you opened last, then the most recent ones.
  const featured = useMemo(() => {
    let lastId: string | null = null;
    try {
      lastId = localStorage.getItem("vizai_last_project_id");
    } catch {
      // ignore
    }
    const last = projects.find((p) => p.id === lastId);
    return [...(last ? [last] : []), ...projects.filter((p) => p !== last)].slice(0, 2);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
    );
  }, [projects, searchQuery]);

  if (showNewProjectFlow) {
    return (
      <div className="min-h-full bg-background">
        <OnboardingFlow onComplete={handleNewProjectComplete} onCancel={() => setShowNewProjectFlow(false)} />
      </div>
    );
  }

  const now = new Date();
  const firstName = userName?.split(" ")[0];

  return (
    <div className="home">
      <div className="home-main">
        {/* Header */}
        <motion.header
          className="home-header"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div>
            <h1 className="home-title">
              {greetingFor(now)}
              {firstName ? `, ${firstName}` : ""}
            </h1>
            <p className="home-subtitle">Here's how your products are doing.</p>
          </div>
          <span className="home-date">
            <CalendarDays size={16} aria-hidden="true" />
            Today, {now.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </motion.header>

        {error && projects.length === 0 && !isLoading ? (
          <div className="home-card home-error" role="alert">
            <p className="home-error-title">We couldn't load your products</p>
            <p className="home-muted">{error}</p>
            <button type="button" className="home-btn home-btn--primary" onClick={fetchProjects}>
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <ul className="home-stats" aria-label="Summary">
              {stats.map((s, i) => (
                <motion.li
                  key={s.label}
                  className="home-stat"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.05 + i * 0.05, ease: EASE }}
                >
                  <span className="home-stat-icon">
                    <s.icon size={18} aria-hidden="true" />
                  </span>
                  <span className="home-stat-value">{isLoading ? <span className="home-skel home-skel--num" /> : s.value}</span>
                  <span className="home-stat-label">{s.label}</span>
                </motion.li>
              ))}
            </ul>

            {/* Featured */}
            {(isLoading || featured.length > 0) && (
              <section aria-labelledby="home-featured-title">
                <h2 id="home-featured-title" className="home-section-title">
                  Pick up where you left off
                </h2>
                <div className="home-featured">
                  {isLoading
                    ? [0, 1].map((i) => <div key={i} className="home-card home-skel home-skel--card" />)
                    : featured.map((p, i) => (
                        <FeaturedCard
                          key={p.id}
                          project={p}
                          index={i}
                          onOpen={() => onProjectSelect(p.name, p.id)}
                        />
                      ))}
                </div>
              </section>
            )}

            {/* All products */}
            <section className="home-card home-list-card" aria-labelledby="home-list-title">
              <div className="home-list-head">
                <h2 id="home-list-title" className="home-section-title home-section-title--flush">
                  All products
                  {!isLoading && <span className="home-count">{projects.length}</span>}
                </h2>
                <div className="home-list-tools">
                  <label className="home-search">
                    <Search size={16} aria-hidden="true" />
                    <span className="sr-only">Search products</span>
                    <input
                      type="search"
                      placeholder="Search products"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <button type="button" className="home-btn home-btn--primary" onClick={() => setShowNewProjectFlow(true)}>
                    <Plus size={16} aria-hidden="true" />
                    New product
                  </button>
                </div>
              </div>

              {isLoading ? (
                <div className="home-rows">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="home-skel home-skel--row" />
                  ))}
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="home-empty">
                  <span className="home-empty-icon">
                    <LayoutDashboard size={24} aria-hidden="true" />
                  </span>
                  <p className="home-empty-title">{searchQuery ? "No matching products" : "No products yet"}</p>
                  <p className="home-muted">
                    {searchQuery
                      ? `Nothing matches "${searchQuery}". Try a different name.`
                      : "Create a product, connect a database, and start asking questions."}
                  </p>
                  {!searchQuery && (
                    <button type="button" className="home-btn home-btn--primary" onClick={() => setShowNewProjectFlow(true)}>
                      <Plus size={16} aria-hidden="true" />
                      Create your first product
                    </button>
                  )}
                </div>
              ) : (
                <ul className="home-rows">
                  <AnimatePresence initial={false}>
                    {filteredProjects.map((p, i) => (
                      <ProductRow
                        key={p.id}
                        project={p}
                        index={i}
                        onOpen={() => onProjectSelect(p.name, p.id)}
                        onDelete={() => setProjectToDelete(p)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {/* Right rail */}
      <aside className="home-rail" aria-label="Shortcuts">
        <motion.section
          className="home-hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
        >
          <p className="home-hero-eyebrow">Ask VizAI</p>
          <h2 className="home-hero-title">Questions in. Charts out.</h2>
          <div className="home-hero-demo" aria-hidden="true">
            <AskDemo />
          </div>

          {isLoading ? (
            <div className="home-skel" style={{ height: 120, borderRadius: 16, opacity: 0.25 }} />
          ) : projects.length === 0 ? (
            <>
              <p className="home-hero-text">Create a product and connect a database — then ask anything in plain language.</p>
              <button type="button" className="home-btn home-btn--hero" onClick={() => setShowNewProjectFlow(true)}>
                Create a product
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </>
          ) : (
            (() => {
              const target = projects.find((p) => p.id === askProjectId) ?? featured[0] ?? projects[0];
              const submit = (q: string) => {
                if (!target) return;
                if (onAskInProduct) onAskInProduct(target.name, target.id, q);
                else onProjectSelect(target.name, target.id);
              };
              return (
                <form
                  className="home-ask"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit(askText);
                  }}
                >
                  <div className="home-ask-box">
                    <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setPickerQuery(""); }}>
                      <PopoverTrigger asChild>
                        <button type="button" className="home-ask-target" aria-label={`Product: ${target?.name}. Change product`}>
                          <span className="home-ask-target-label">Asking in</span>
                          <span className={`app-tile app-tile--xs tone-${toneFor(target?.name ?? "")}`} aria-hidden="true">{initialsFor(target?.name ?? "?")}</span>
                          <span className="home-ask-target-name">{target?.name}</span>
                          <ChevronDown size={14} aria-hidden="true" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-72 p-2">
                        <label className="home-picker-search">
                          <Search size={14} aria-hidden="true" />
                          <input
                            autoFocus
                            value={pickerQuery}
                            onChange={(e) => setPickerQuery(e.target.value)}
                            placeholder={`Search ${projects.length} products`}
                            aria-label="Search products"
                          />
                        </label>
                        <div className="home-picker-list" role="listbox" aria-label="Products">
                          {[...(featured[0] ? [featured[0]] : []), ...projects.filter((p) => p.id !== featured[0]?.id)]
                            .filter((p) => p.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
                            .map((p, i) => {
                              const active = p.id === target?.id;
                              const setup = setupProgress(p);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  role="option"
                                  aria-selected={active}
                                  className={`home-picker-item${active ? " is-active" : ""}`}
                                  onClick={() => {
                                    setAskProjectId(p.id);
                                    setPickerOpen(false);
                                    setPickerQuery("");
                                  }}
                                >
                                  <span className={`app-tile app-tile--sm tone-${toneFor(p.name)}`} aria-hidden="true">{initialsFor(p.name)}</span>
                                  <span className="min-w-0 flex-1 text-left">
                                    <span className="home-picker-name">{p.name}</span>
                                    <span className="home-picker-meta">
                                      {i === 0 && !pickerQuery ? "Recent · " : ""}
                                      {setup.next ?? `${p.dashboards} dashboard${p.dashboards === 1 ? "" : "s"}`}
                                    </span>
                                  </span>
                                  {active && <Check size={14} aria-hidden="true" className="text-primary" />}
                                </button>
                              );
                            })}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <label className="home-ask-input">
                      <span className="sr-only">Question for {target?.name}</span>
                      <input
                        value={askText}
                        onChange={(e) => setAskText(e.target.value)}
                        placeholder="Ask a question about your data…"
                      />
                      <button type="submit" aria-label={`Ask in ${target?.name}`} className="home-ask-send">
                        <ArrowRight size={16} />
                      </button>
                    </label>
                  </div>

                  <div className="home-ask-suggestions">
                    {ASK_SUGGESTIONS.map((q) => (
                      <button key={q} type="button" onClick={() => setAskText(q)}>
                        {q}
                      </button>
                    ))}
                  </div>

                  {target && target.databases === 0 && (
                    <p className="home-ask-note">{target.name} has no database yet — you'll connect one first.</p>
                  )}
                </form>
              );
            })()
          )}
        </motion.section>

        <section className="home-card home-apps" aria-labelledby="home-apps-title">
          <div className="home-apps-head">
            <div>
              <h2 id="home-apps-title" className="home-section-title home-section-title--flush">
                Registered apps
              </h2>
              <p className="home-muted home-small">Sites allowed to embed your dashboards.</p>
            </div>
            <button
              id="create-app-btn"
              type="button"
              className="home-icon-btn home-icon-btn--accent"
              onClick={() => setShowCreateAppModal(true)}
              aria-label="Register an app"
            >
              <Plus size={18} />
            </button>
          </div>

          {apps.length === 0 ? (
            <div className="home-apps-empty">
              <Globe size={20} aria-hidden="true" />
              <p className="home-muted home-small">No apps yet. Register a domain to embed dashboards on it.</p>
              <button type="button" className="home-btn home-btn--ghost" onClick={() => setShowCreateAppModal(true)}>
                Register an app
              </button>
            </div>
          ) : (
            <ul className="home-apps-list">
              {apps.map((app) => (
                <li key={app.app_id} className="home-app">
                  <span className={`app-tile tone-${toneFor(app.company_name)}`}>{initialsFor(app.company_name)}</span>
                  <div className="home-app-text">
                    <p className="home-app-name">{app.company_name}</p>
                    <p className="home-app-meta">
                      {app.domain_url}
                      <span aria-hidden="true"> · </span>
                      {new Date(app.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <span className={`home-pill ${app.is_active ? "home-pill--ok" : ""}`}>
                    {app.is_active ? "Active" : "Inactive"}
                  </span>
                  <button
                    type="button"
                    className="home-icon-btn home-icon-btn--danger"
                    onClick={() => setAppToDelete(app)}
                    aria-label={`Delete ${app.company_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <CreateAppModal open={showCreateAppModal} onOpenChange={setShowCreateAppModal} onAppCreated={fetchApps} />

      <ConfirmDelete
        open={!!projectToDelete}
        busy={isDeletingProject}
        title={`Delete "${projectToDelete?.name}"?`}
        description="This removes its dashboards and data source connections from the workspace. This can't be undone."
        onCancel={() => setProjectToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
      <ConfirmDelete
        open={!!appToDelete}
        busy={isDeletingApp}
        title={`Remove "${appToDelete?.company_name}"?`}
        description={`Dashboards embedded on ${appToDelete?.domain_url ?? "this domain"} will stop loading.`}
        onCancel={() => setAppToDelete(null)}
        onConfirm={handleConfirmDeleteApp}
      />
    </div>
  );
}

/* ── Pieces ── */

function ProgressRing({ pct, size = 40 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="home-ring" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} className="home-ring-track" />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className={`home-ring-value${pct === 100 ? " is-done" : ""}`}
        style={{ rotate: -90, transformOrigin: "50% 50%" }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: pct / 100 }}
        transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
      />
    </svg>
  );
}

function FeaturedCard({ project, index, onOpen }: { project: UIProject; index: number; onOpen: () => void }) {
  const setup = setupProgress(project);
  return (
    <motion.button
      type="button"
      className="home-card home-feature"
      onClick={onOpen}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 + index * 0.08, ease: EASE }}
      whileHover={{ y: -3 }}
    >
      <div className="home-feature-top">
        <span className={`app-tile app-tile--lg tone-${toneFor(project.name)}`}>{initialsFor(project.name)}</span>
        <span className="home-pill">{index === 0 ? "Recent" : "Product"}</span>
      </div>
      <h3 className="home-feature-title">{project.name}</h3>
      <p className="home-feature-desc">{project.description || "No description yet."}</p>
      <div className="home-feature-stats">
        <div>
          <p className="home-label">Setup</p>
          <div className="home-feature-progress">
            <ProgressRing pct={setup.pct} size={32} />
            <span className="home-feature-pct">{setup.pct}%</span>
          </div>
        </div>
        <div>
          <p className="home-label">Next step</p>
          <p className="home-feature-next">{setup.next ?? "All set"}</p>
        </div>
      </div>
      <div className="home-feature-foot">
        <Meta icon={LayoutDashboard} value={project.dashboards} label="dashboards" />
        <Meta icon={Database} value={project.databases} label="data sources" />
        <Meta icon={UsersIcon} value={project.team} label="members" />
        <span className="home-feature-open" aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </div>
    </motion.button>
  );
}

function ProductRow({
  project,
  index,
  onOpen,
  onDelete,
}: {
  project: UIProject;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const setup = setupProgress(project);
  return (
    <motion.li
      layout
      className="home-row"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.03, ease: EASE }}
    >
      <button type="button" className="home-row-main" onClick={onOpen} title={project.description || undefined}>
        <span className={`app-tile tone-${toneFor(project.name)}`}>{initialsFor(project.name)}</span>
        <span className="home-row-text">
          <span className="home-row-name">{project.name}</span>
          <span className="home-row-desc">{project.description || "No description"}</span>
        </span>
        <span className="home-row-progress" aria-label={`Setup ${setup.done} of 3 steps complete`}>
          <ProgressRing pct={setup.pct} size={28} />
          <span>{setup.pct}%</span>
        </span>
        <span className="home-row-meta">
          <Meta icon={LayoutDashboard} value={project.dashboards} label="dashboards" />
          <Meta icon={Database} value={project.databases} label="data sources" />
          <Meta icon={UsersIcon} value={project.team} label="members" />
        </span>
        <span className="home-row-date">{project.lastActive}</span>
      </button>
      <button type="button" className="home-icon-btn home-icon-btn--danger" onClick={onDelete} aria-label={`Delete ${project.name}`}>
        <Trash2 size={16} />
      </button>
    </motion.li>
  );
}

function Meta({ icon: Icon, value, label }: { icon: typeof Database; value: number; label: string }) {
  return (
    <span className="home-meta" title={`${value} ${label}`}>
      <Icon size={14} aria-hidden="true" />
      {value}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

function ConfirmDelete({
  open,
  busy,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onCancel();
      }}
    >
      <AlertDialogContent className="border-border">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
          >
            {busy ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting…
              </span>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
