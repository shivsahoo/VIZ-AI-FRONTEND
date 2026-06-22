import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, Loader2, ChevronLeft, Database } from "lucide-react";
import { Button } from "../../ui/button";
import { Card } from "../../ui/card";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { Label } from "../../ui/label";
import { toast } from "sonner";
import { cn } from "../../ui/utils";
import { createDashboard, getDatabases } from "../../../services/api";

/** Normalise raw backend db_type strings to the values the WebSocket / LLM service expect. */
const normalizeDbType = (raw: string): string => {
  const t = (raw || "").toLowerCase().trim();
  const aliases: Record<string, string> = {
    postgresql: "postgres",
    pg: "postgres",
    oracle: "oracledb",
    mssql: "mysql",
    "sql server": "mysql",
    spark: "databricks",
  };
  return aliases[t] ?? t ?? "postgres";
};

const getErrorMessage = (error: any): string => {
  if (!error) return "Something went wrong";
  if (typeof error === "string") return error;
  if (error instanceof Error && typeof error.message === "string") return error.message;
  if (typeof error?.message === "string") return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Something went wrong";
  }
};

interface DatabaseConnection {
  id: string;
  name: string;
  db_type: string;
  db_schema?: string;
}

interface AutopilotDashboardFormProps {
  projectId: string;
  onComplete: (data: {
    name: string;
    description: string;
    dashboardId: string;
    kpiGoals: string;
    connectionId: string;
    dbSchema: string;
    dbType: string;
  }) => void;
  onCancel?: () => void;
}

export function AutopilotDashboardForm({
  projectId,
  onComplete,
  onCancel,
}: AutopilotDashboardFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [kpiGoals, setKpiGoals] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    description?: string;
    kpiGoals?: string;
    connection?: string;
  }>({});

  useEffect(() => {
    const loadConnections = async () => {
      setIsLoadingConnections(true);
      try {
        const response = await getDatabases(projectId);
        if (response.success && response.data && response.data.length > 0) {
          const mapped: DatabaseConnection[] = response.data.map((c: any) => ({
            id: c.id,
            name: c.name || c.connection_name || "Unnamed Connection",
            db_type: normalizeDbType(c.type || c.db_type || "postgres"),
            db_schema: c.schema || c.db_schema || "",
          }));
          setConnections(mapped);
          setSelectedConnectionId(mapped[0].id);
        }
      } catch {
        toast.error("Failed to load data connections");
      } finally {
        setIsLoadingConnections(false);
      }
    };
    loadConnections();
  }, [projectId]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!name.trim()) newErrors.name = "Dashboard name is required";
    else if (name.trim().length < 2)
      newErrors.name = "Dashboard name must be at least 2 characters";

    if (!kpiGoals.trim()) newErrors.kpiGoals = "Please describe what you want to monitor";
    else if (kpiGoals.trim().length < 10)
      newErrors.kpiGoals = "Please provide more detail (at least 10 characters)";

    if (!selectedConnectionId) {
      newErrors.connection = "Please select a data connection";
    } else {
      const selectedConn = connections.find((c) => c.id === selectedConnectionId);
      if (selectedConn && !selectedConn.db_schema) {
        newErrors.connection =
          "This connection has no schema loaded. Open Databases, select the connection, and run schema introspection first.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    if (!validateForm()) return;

    setIsCreating(true);
    try {
      const response = await createDashboard(projectId, {
        name: name.trim(),
        description: description.trim() || `Autopilot dashboard: ${kpiGoals.trim().slice(0, 100)}`,
        is_autopilot: true,
        kpi_goals: kpiGoals.trim(),
      });

      if (!response.success || !response.data?.id) {
        throw new Error(response.error?.message || "Failed to create dashboard");
      }

      const selectedConn = connections.find((c) => c.id === selectedConnectionId);

      toast.success("Autopilot Dashboard created! Generating your charts...");
      onComplete({
        name: name.trim(),
        description: description.trim(),
        dashboardId: String(response.data.id),
        kpiGoals: kpiGoals.trim(),
        connectionId: selectedConnectionId,
        dbSchema: selectedConn?.db_schema || "",
        dbType: selectedConn?.db_type || "postgres",
      });
    } catch (error: any) {
      console.error("Failed to create autopilot dashboard:", error);
      toast.error(getErrorMessage(error) || "Failed to create dashboard. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="border border-border shadow-xl overflow-hidden">
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-3 w-full">
            {onCancel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="text-muted-foreground hover:text-foreground w-8 h-8 flex-shrink-0"
                disabled={isCreating}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold">Autopilot Dashboard</h3>
              <p className="text-xs text-muted-foreground">
                Describe your goals — AI builds the full dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="px-6 py-8">
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* KPI Goals — shown first since it's the key field */}
            <div className="space-y-2.5">
              <Label htmlFor="kpiGoals" className="text-sm font-semibold text-foreground">
                What do you want to monitor?{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="kpiGoals"
                value={kpiGoals}
                onChange={(e) => {
                  setKpiGoals(e.target.value);
                  if (errors.kpiGoals)
                    setErrors((prev) => ({ ...prev, kpiGoals: undefined }));
                }}
                placeholder="e.g., Monthly revenue trend, top 10 customers by sales, churn rate, regional performance, conversion funnel..."
                className={cn(
                  "w-full min-h-[110px] resize-none border-2 transition-all duration-200",
                  errors.kpiGoals
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border hover:border-primary/50 focus:border-purple-400/60 focus:ring-purple-400/20",
                  "bg-background shadow-sm hover:shadow-md focus:shadow-lg",
                  "outline-none focus:outline-none focus-visible:outline-none",
                  "ring-0 focus:ring-2 focus:ring-purple-400/20"
                )}
                disabled={isCreating}
                autoFocus
                maxLength={2000}
              />
              {errors.kpiGoals && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive font-medium flex items-center gap-1"
                >
                  <span>⚠</span> {errors.kpiGoals}
                </motion.p>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed">
                The more specific you are, the better your charts will be
              </p>
            </div>

            {/* Data Connection */}
            <div className="space-y-2.5">
              <Label htmlFor="connection" className="text-sm font-semibold text-foreground">
                Data Connection <span className="text-destructive">*</span>
              </Label>
              {isLoadingConnections ? (
                <div className="flex items-center gap-2 h-11 px-3 rounded-md border-2 border-border bg-muted/30">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading connections...</span>
                </div>
              ) : connections.length === 0 ? (
                <div className="flex items-center gap-2 h-11 px-3 rounded-md border-2 border-border bg-muted/10">
                  <Database className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">No connections available for this project</span>
                </div>
              ) : (
                <div className="grid gap-2">
                  {connections.map((conn) => (
                    <label
                      key={conn.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-150",
                        selectedConnectionId === conn.id
                          ? "border-primary/60 bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                      )}
                    >
                      <input
                        type="radio"
                        name="connection"
                        value={conn.id}
                        checked={selectedConnectionId === conn.id}
                        onChange={() => {
                          setSelectedConnectionId(conn.id);
                          if (errors.connection)
                            setErrors((prev) => ({ ...prev, connection: undefined }));
                        }}
                        className="accent-primary"
                        disabled={isCreating}
                      />
                      <Database className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground">{conn.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground uppercase tracking-wide">
                        {conn.db_type}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.connection && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive font-medium flex items-center gap-1"
                >
                  <span>⚠</span> {errors.connection}
                </motion.p>
              )}
            </div>

            {/* Dashboard Name */}
            <div className="space-y-2.5">
              <Label htmlFor="dashboardName" className="text-sm font-semibold text-foreground">
                Dashboard Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dashboardName"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="e.g., Revenue & Growth Overview"
                className={cn(
                  "w-full h-11 border-2 transition-all duration-200",
                  errors.name
                    ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                    : "border-border hover:border-primary/50 focus:border-purple-400/60 focus:ring-purple-400/20",
                  "bg-background shadow-sm hover:shadow-md focus:shadow-lg",
                  "outline-none focus:outline-none focus-visible:outline-none",
                  "ring-0 focus:ring-2 focus:ring-purple-400/20"
                )}
                disabled={isCreating}
                maxLength={100}
              />
              {errors.name && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-destructive font-medium flex items-center gap-1"
                >
                  <span>⚠</span> {errors.name}
                </motion.p>
              )}
            </div>

            {/* Description (optional) */}
            <div className="space-y-2.5">
              <Label htmlFor="dashboardDescription" className="text-sm font-semibold text-foreground">
                Description{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="dashboardDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Executive overview of revenue health and customer metrics"
                className={cn(
                  "w-full min-h-[80px] resize-none border-2 transition-all duration-200",
                  "border-border hover:border-primary/50 focus:border-purple-400/60 focus:ring-purple-400/20",
                  "bg-background shadow-sm hover:shadow-md focus:shadow-lg",
                  "outline-none focus:outline-none focus-visible:outline-none",
                  "ring-0 focus:ring-2 focus:ring-purple-400/20"
                )}
                disabled={isCreating}
                maxLength={500}
              />
            </div>

            {/* Submit */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={isCreating || isLoadingConnections || connections.length === 0}
                className={cn(
                  "h-11 px-6 font-semibold",
                  "bg-gradient-to-r from-primary to-accent text-white",
                  "shadow-lg hover:shadow-xl transition-all duration-300"
                )}
              >
                {isCreating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Generate Dashboard
                  </span>
                )}
              </Button>
            </div>
          </motion.form>
        </div>
      </div>
    </Card>
  );
}
