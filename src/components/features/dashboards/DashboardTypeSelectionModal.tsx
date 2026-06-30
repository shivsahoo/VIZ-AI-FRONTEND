import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { LayoutDashboard, Sparkles, ArrowRight, FileUp, Upload, Briefcase, Sliders, Plus, MessageSquare, BarChart3, Search, Clock, Loader2, Database, CheckCircle2 } from "lucide-react";
import { Button } from "../../ui/button";
import { cn } from "../../ui/utils";
import { toast } from "sonner";
import { DashboardCreationForm } from "./DashboardCreationForm";
import { AutopilotDashboardForm } from "./AutopilotDashboardForm";
import { getDatabases, uploadPbitFile, getLatestOntology, createDashboard } from "../../../services/api";

interface DatabaseConnection {
  id: string;
  name: string;
  db_type: string;
  schema?: string | null;
}

type DashboardMode = "select" | "manual" | "autopilot";
type PbitFlowPhase = "idle" | "extracting" | "creating" | "done";

interface DashboardTypeSelectionModalProps {
  projectId: string;
  onComplete: (data: {
    name: string;
    description: string;
    dashboardId: string;
    isAutopilot?: boolean;
    kpiGoals?: string;
    connectionId?: string;
    dbSchema?: string;
    dbType?: string;
    isPbitGenerated?: boolean;
  }) => void;
  onCancel?: () => void;
}

/** Build the enriched kpi_goals string from ontology metrics (capped at 10). */
function buildKpiGoalsFromMetrics(metrics: Array<{ name?: string; formula?: string }>): string {
  const capped = metrics.slice(0, 10);
  const lines = capped
    .filter((m) => m.name)
    .map((m, i) => {
      const formula = m.formula ? `\n   Formula: ${m.formula}` : "";
      return `${i + 1}. ${m.name}${formula}`;
    })
    .join("\n\n");

  return [
    "PBIT METRICS — Generate charts that directly visualize these business metrics.",
    "Use the SQL formulas as the primary basis for each chart query.",
    "",
    lines,
    "",
    "If a formula cannot be executed against the DB schema, derive the closest equivalent chart from the ontology context and schema.",
  ].join("\n");
}

export function DashboardTypeSelectionModal({
  projectId,
  onComplete,
  onCancel,
}: DashboardTypeSelectionModalProps) {
  const [mode, setMode] = useState<DashboardMode>("select");
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>("");
  const [pbitFlowPhase, setPbitFlowPhase] = useState<PbitFlowPhase>("idle");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLocked = pbitFlowPhase !== "idle";

  useEffect(() => {
    let isMounted = true;
    const fetchConnections = async () => {
      setIsLoadingConnections(true);
      try {
        const response = await getDatabases(projectId);
        if (isMounted && response.success && response.data) {
          const mapped: DatabaseConnection[] = response.data.map((c: any) => ({
            id: c.id,
            name: c.name || c.connection_name || "Unnamed Connection",
            db_type: c.db_type || c.type || "postgres",
            schema: c.schema ?? null,
          }));
          setConnections(mapped);
          if (mapped.length > 0) {
            setSelectedConnectionId(mapped[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to load connections:", err);
      } finally {
        if (isMounted) setIsLoadingConnections(false);
      }
    };
    fetchConnections();
    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const handlePbitUploadClick = () => {
    if (!selectedConnectionId) {
      toast.error("Please select a data source first.");
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handlePbitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!selectedConnectionId) {
      toast.error("Please select a data source first.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pbit")) {
      toast.error("Only .pbit files are supported.");
      return;
    }

    const selectedConnection = connections.find((c) => c.id === selectedConnectionId);

    // ── Phase 1: Extract metrics from .pbit ─────────────────────────────────
    setPbitFlowPhase("extracting");
    try {
      const uploadResp = await uploadPbitFile(selectedConnectionId, file);
      if (!uploadResp.success || !uploadResp.data) {
        toast.error(uploadResp.error?.message || "Failed to import .pbit file");
        setPbitFlowPhase("idle");
        return;
      }
      setUploadedFileName(file.name);
    } catch (error: any) {
      toast.error(error.message || "Failed to import .pbit file");
      setPbitFlowPhase("idle");
      return;
    }

    // ── Phase 2: Fetch ontology, build kpiGoals, create dashboard ───────────
    setPbitFlowPhase("creating");
    try {
      const ontologyResp = await getLatestOntology(selectedConnectionId);
      const metrics: Array<{ name?: string; formula?: string }> =
        (ontologyResp.success && ontologyResp.data?.ontology?.metrics) || [];

      const kpiGoals = buildKpiGoalsFromMetrics(metrics);
      const dbSchema = selectedConnection?.schema ?? "";
      const dbType = selectedConnection?.db_type ?? "postgres";
      const placeholderName = `${selectedConnection?.name ?? "Untitled"} Dashboard`;

      const createResp = await createDashboard(projectId, {
        name: placeholderName,
        description: "Generated from .pbit",
        is_autopilot: true,
        kpi_goals: kpiGoals,
      });

      if (!createResp.success || !createResp.data) {
        toast.error(createResp.error?.message || "Failed to create dashboard");
        setPbitFlowPhase("idle");
        return;
      }

      setPbitFlowPhase("done");
      onComplete({
        name: placeholderName,
        description: "Generated from .pbit",
        dashboardId: createResp.data.id,
        isAutopilot: true,
        kpiGoals,
        connectionId: selectedConnectionId,
        dbSchema,
        dbType,
        isPbitGenerated: true,
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to generate dashboard");
      setPbitFlowPhase("idle");
    }
  };

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
      {/* Hidden file input for .pbit upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".pbit"
        onChange={handlePbitFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-foreground font-semibold">Create new dashboard</h3>
            <p className="text-xs text-muted-foreground">
              Choose how you'd like to build your dashboard
            </p>
          </div>
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isLocked}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Mode Selection Cards */}
      <div className={cn("px-8 py-10 transition-opacity duration-200", isLocked && "opacity-75 pointer-events-none")}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {/* Autopilot Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className={cn(
              "relative flex flex-col items-start text-left rounded-2xl border p-8 transition-all duration-200 h-full min-h-[460px]",
              "border-primary/60 bg-card",
              "shadow-sm"
            )}
          >
            {/* Badge */}
            <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-white shadow-sm">
              Recommended
            </span>

            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shadow-sm mb-5">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>

            <h4 className="text-foreground font-semibold text-lg mb-2">Autopilot dashboard</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[44px]">
              Describe the KPIs you want to monitor. AI builds a full dashboard with 5-6 charts.
            </p>

            <ul className="space-y-3.5 text-sm text-muted-foreground mb-8 w-full">
              <li className="flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
                <span>5-6 AI-generated charts</span>
              </li>
              <li className="flex items-center gap-3">
                <Search className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Probe mode on every chart</span>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <span>Ready in seconds</span>
              </li>
            </ul>

            <div className="mt-auto pt-4 w-full">
              <button
                type="button"
                onClick={() => setMode("autopilot")}
                disabled={isLocked}
                className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
              >
                Get started
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>

          {/* Generate from .pbit */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className={cn(
              "flex flex-col items-start text-left rounded-2xl border p-8 transition-all duration-200 h-full min-h-[460px]",
              "border-border/60 bg-card",
              "shadow-sm"
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shadow-sm mb-5">
              <FileUp className="w-6 h-6 text-muted-foreground" />
            </div>

            <h4 className="text-foreground font-semibold text-lg mb-2">Generate from .pbit</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[44px]">
              Upload a Power BI template and pick a data source — AI rebuilds it as a dashboard.
            </p>

            <div className="w-full flex-1 flex flex-col justify-between my-1">
              <div className="space-y-2 mb-6">
                <label className="text-xs font-medium text-muted-foreground block">Data source</label>
                {isLoadingConnections ? (
                  <div className="w-full py-3 px-3.5 rounded-xl border border-border/60 bg-muted/30 flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                    <span>Loading connections...</span>
                  </div>
                ) : connections.length === 0 ? (
                  <div className="w-full py-3 px-3.5 rounded-xl border border-border/60 bg-muted/10 flex items-center gap-2.5 text-sm text-muted-foreground">
                    <Database className="w-4 h-4 flex-shrink-0" />
                    <span>No connections available</span>
                  </div>
                ) : (
                  <select
                    value={selectedConnectionId}
                    onChange={(e) => setSelectedConnectionId(e.target.value)}
                    disabled={isLocked}
                    className="w-full py-3 px-3.5 rounded-xl border border-border/60 bg-background hover:bg-accent/20 focus:border-primary focus:outline-none text-sm text-foreground transition-colors cursor-pointer"
                  >
                    <option value="" disabled>Select a connection</option>
                    {connections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.name} ({conn.db_type})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-2 mt-auto pt-4">
                <label className="text-xs font-medium text-muted-foreground block">.pbit file</label>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handlePbitUploadClick}
                  onKeyDown={(e) => e.key === "Enter" && handlePbitUploadClick()}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-sm",
                    isLocked
                      ? "bg-primary/50 text-primary-foreground cursor-default"
                      : uploadedFileName
                        ? "bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                  )}
                >
                  {pbitFlowPhase === "extracting" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>Extracting metrics...</span>
                    </>
                  ) : pbitFlowPhase === "creating" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>Generating dashboard...</span>
                    </>
                  ) : uploadedFileName ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-white flex-shrink-0" />
                      <span className="truncate max-w-[180px] font-medium">{uploadedFileName}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 flex-shrink-0" />
                      <span>Click to upload</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Manual Dashboard */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className={cn(
              "flex flex-col items-start text-left rounded-2xl border p-8 transition-all duration-200 h-full min-h-[460px]",
              "border-border/60 bg-card",
              "shadow-sm"
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shadow-sm mb-5">
              <Briefcase className="w-6 h-6 text-muted-foreground" />
            </div>

            <h4 className="text-foreground font-semibold text-lg mb-2">Manual dashboard</h4>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6 min-h-[44px]">
              Start with a blank dashboard and build it your way using the AI Assistant or Charts view.
            </p>

            <ul className="space-y-3.5 text-sm text-muted-foreground mb-8 w-full">
              <li className="flex items-center gap-3">
                <Sliders className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>Full creative control</span>
              </li>
              <li className="flex items-center gap-3">
                <Plus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>Add charts one by one</span>
              </li>
              <li className="flex items-center gap-3">
                <MessageSquare className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>Use AI Assistant anytime</span>
              </li>
            </ul>

            <div className="mt-auto pt-4 w-full">
              <button
                type="button"
                onClick={() => setMode("manual")}
                disabled={isLocked}
                className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
              >
                Create blank
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
