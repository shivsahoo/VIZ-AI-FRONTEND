import { Plus, Database, Check, X, MoreVertical, Pencil, Trash2, Eye, TrendingUp, Clock, Tag, Filter, Bot } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { GradientButton } from "../components/shared/GradientButton";
import { StatusBadge } from "../components/shared/StatusBadge";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "sonner";
import { DatabaseConnectionFlow } from "../components/features/databases/DatabaseConnectionFlow";
import { DSGraphViewer } from "../components/features/databases/DSGraphViewer";
import { OntologyViewer } from "../components/features/databases/OntologyViewer";
import { OnboardingTour, type TourOutcome } from "../components/shared/OnboardingTour";

import {
  getDatabases,
  deleteConnection,
  updateConnection,
  getDatabaseDSGraph,
  getLatestOntology,
  bootstrapOntology,
  downloadLatestOntologyTTL,
  startOntologyEnrichment,
  sendOntologyEnrichmentChat,
  applyOntologyEnrichment,
  uploadPbitFile,
  type DSGraphPayload,
  type OntologyVersionPayload,
} from "../services/api";
import { storeDatabaseMetadata, type DatabaseMetadataEntry } from "../utils/databaseMetadata";

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  rawType?: string;
  host: string;
  status: string;
  lastChecked: string;
  hasDsGraph?: boolean;
}

interface DatabasesViewProps {
  projectId?: string | number;
}

export function DatabasesView({ projectId }: DatabasesViewProps) {
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showConnectionFlow, setShowConnectionFlow] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseConnection | null>(null);
  const [dsGraphDialogOpen, setDsGraphDialogOpen] = useState(false);
  const [isGraphLoading, setIsGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [currentGraph, setCurrentGraph] = useState<DSGraphPayload | null>(null);
  const [showTour, setShowTour] = useState(false);

  // Ontology dialog state
  const [ontologyDialogOpen, setOntologyDialogOpen] = useState(false);
  const [isOntologyLoading, setIsOntologyLoading] = useState(false);
  const [ontologyError, setOntologyError] = useState<string | null>(null);
  const [currentOntology, setCurrentOntology] = useState<OntologyVersionPayload | null>(null);
  const [enrichChatOpen, setEnrichChatOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentSessionId, setEnrichmentSessionId] = useState<string | null>(null);
  const [enrichmentInput, setEnrichmentInput] = useState("");
  const [enrichmentChat, setEnrichmentChat] = useState<Array<{ role: "assistant" | "user"; text: string }>>([]);
  const [isEnrichmentReplyPending, setIsEnrichmentReplyPending] = useState(false);
  const [enrichmentUpdates, setEnrichmentUpdates] = useState<Record<string, any>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPbitUploading, setIsPbitUploading] = useState(false);

  // Edit form state (for editing existing connections)
  const [connectionName, setConnectionName] = useState("");
  const [dbType, setDbType] = useState("postgresql");
  const [host, setHost] = useState("");
  const [isUpdatingConnection, setIsUpdatingConnection] = useState(false);

  // Helper function to format time ago
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const fetchDatabases = useCallback(async (): Promise<DatabaseConnection[]> => {
    if (!projectId) return [];

    setIsLoading(true);
    try {
      const response = await getDatabases(String(projectId));
      if (response.success && response.data) {
        const metadataEntries: DatabaseMetadataEntry[] = response.data.map((db) => ({
          id: db.id,
          name: db.name,
          type: db.type,
          schema: db.schema ?? null,
        }));
        storeDatabaseMetadata(String(projectId), metadataEntries);

        // Map API Database format to DatabaseConnection format
        const mappedDatabases: DatabaseConnection[] = response.data.map((db) => {
          const rawType = (db.type || '').toLowerCase();
          let displayType = db.type;
          if (rawType === 'postgresql' || rawType === 'postgres') {
            displayType = 'PostgreSQL';
          } else if (rawType === 'mysql') {
            displayType = 'MySQL';
          } else if (rawType === 'oracledb' || rawType === 'oracle') {
            displayType = 'Oracle';
          } else if (rawType === 'salesforce') {
            displayType = 'Salesforce';
          } else if (rawType === 'databricks') {
            displayType = 'Databricks';
          }

          return {
            id: db.id,
            name: db.name,
            type: displayType,
            rawType,
            host: db.host || 'N/A',
            status: db.status,
            lastChecked: formatTimeAgo(db.lastChecked),
            hasDsGraph: db.hasDsGraph,
          };
        });
        setDatabases(mappedDatabases);
        return mappedDatabases;
      } else {
        toast.error(response.error?.message || "Failed to load databases");
        setDatabases([]);
        return [];
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while fetching databases");
      setDatabases([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Fetch databases from API
  useEffect(() => {
    if (projectId) {
      fetchDatabases();
    } else {
      setIsLoading(false);
    }
  }, [projectId, fetchDatabases]);

  const handleConnectionFlowComplete = async (connectionData: {
    database: any;
    selectedTables: string[];
    databaseContext: Record<string, string>;
  }) => {
    const dbName = connectionData.database.connectionName || connectionData.database.name || "New Database";
    toast.success(`Database "${dbName}" connected successfully!`);

    // Refresh the database list from API
    const refreshedDatabases = projectId ? await fetchDatabases() : [];
    setShowConnectionFlow(false);

    // Open Data Source preview (DS Graph) immediately after successful connection
    const connectedDbId = connectionData.database.id || connectionData.database.connectionId;
    const connectedDb =
      refreshedDatabases.find((db) => db.id === connectedDbId || db.name === dbName) ||
      (connectedDbId
        ? {
          id: String(connectedDbId),
          name: dbName,
          type: connectionData.database.dbType || "Database",
          rawType: connectionData.database.dbType || "",
          host: connectionData.database.host || "N/A",
          status: "connected",
          lastChecked: "just now",
          hasDsGraph: true,
        }
        : null);

    if (connectedDb) {
      // Database-driven tour trigger: the refreshed list already includes the
      // just-added connection, so length === 1 means this was the first one.
      const isFirstConnection = refreshedDatabases.length <= 1;
      await handleViewDSGraph(connectedDb, { startTour: isFirstConnection });
    }
  };

  const handleViewConnection = (db: DatabaseConnection) => {
    setSelectedDatabase(db);
    setViewDialogOpen(true);
  };

  const handleViewDSGraph = async (
    db: DatabaseConnection,
    options?: { startTour?: boolean }
  ) => {
    setSelectedDatabase(db);
    setDsGraphDialogOpen(true);
    setIsGraphLoading(true);
    setGraphError(null);
    setCurrentGraph(null);
    try {
      const response = await getDatabaseDSGraph(db.id);
      if (response.success && response.data) {
        setCurrentGraph(response.data);
        // Start the tour only when the caller explicitly requests it
        // (determined by connection count in handleConnectionFlowComplete)
        if (options?.startTour) {
          setShowTour(true);
        }
      } else {
        setGraphError(response.error?.message || "Unable to load datasource graph");
      }
    } catch (error: any) {
      setGraphError(error.message || "Unable to load datasource graph");
    } finally {
      setIsGraphLoading(false);
    }
  };

  const handleEnrichDatasource = async (db: DatabaseConnection) => {
    setSelectedDatabase(db);
    setOntologyDialogOpen(true);
    setIsOntologyLoading(true);
    setOntologyError(null);
    setCurrentOntology(null);
    try {
      // Try to fetch the latest ontology first
      let response = await getLatestOntology(db.id);
      if (!response.success || !response.data) {
        // No ontology yet — bootstrap one from the DS graph (silent UX)
        response = await bootstrapOntology(db.id);
      }
      if (response.success && response.data) {
        setCurrentOntology(response.data);
      } else {
        setOntologyError(response.error?.message || "Unable to load ontology");
        toast.error(response.error?.message || "Unable to load ontology");
      }
    } catch (error: any) {
      setOntologyError(error.message || "Unable to load ontology");
      toast.error(error.message || "Unable to load ontology");
    } finally {
      setIsOntologyLoading(false);
    }
  };

  const handleDownloadOntologyTTL = async () => {
    if (!selectedDatabase) return;
    try {
      const response = await downloadLatestOntologyTTL(selectedDatabase.id);
      if (!response.success || !response.data) {
        toast.error(response.error?.message || "Unable to download ontology");
        return;
      }
      const ttl = response.data;
      const blob = new Blob([ttl], { type: "text/turtle;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedDatabase.name || "ontology"}.ttl`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Ontology file downloaded");
    } catch (error: any) {
      toast.error(error.message || "Unable to download ontology");
    }
  };

  const handleStartEnriching = async () => {
    if (!selectedDatabase) return;
    setIsEnriching(true);
    try {
      const response = await startOntologyEnrichment(selectedDatabase.id);
      if (!response.success || !response.data) {
        toast.error(response.error?.message || "Unable to start enrichment");
        return;
      }
      setEnrichmentSessionId(response.data.session_id);
      setEnrichmentUpdates({});
      setEnrichmentChat([
        {
          role: "assistant",
          text: response.data.initial_message || "Let's enrich your ontology. Share business rules, default metrics, and status definitions.",
        },
      ]);
      setEnrichChatOpen(true);
    } catch (error: any) {
      toast.error(error.message || "Unable to start enrichment");
    } finally {
      setIsEnriching(false);
    }
  };

  const handlePbitUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handlePbitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDatabase) return;
    if (!file.name.toLowerCase().endsWith(".pbit")) {
      toast.error("Only .pbit files are supported.");
      return;
    }
    setIsPbitUploading(true);
    try {
      const response = await uploadPbitFile(selectedDatabase.id, file);
      if (!response.success || !response.data) {
        toast.error(response.error?.message || "Failed to import .pbit file");
        return;
      }
      const { imported_metrics, pending_metrics, duplicate_metrics } = response.data;
      toast.success(
        `Business metrics imported successfully. `
      );
      const refreshed = await getLatestOntology(selectedDatabase.id);
      if (refreshed.success && refreshed.data) {
        setCurrentOntology(refreshed.data);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import .pbit file");
    } finally {
      setIsPbitUploading(false);
    }
  };

  // Auto-scroll chat to bottom whenever a new message is added
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [enrichmentChat, isEnrichmentReplyPending]);

  const handleSendEnrichmentMessage = async () => {
    if (!selectedDatabase || !enrichmentSessionId) return;
    const message = enrichmentInput.trim();
    if (!message) return;
    setEnrichmentInput("");
    setEnrichmentChat((prev) => [...prev, { role: "user", text: message }]);
    setIsEnriching(true);
    setIsEnrichmentReplyPending(true);
    try {
      const response = await sendOntologyEnrichmentChat(selectedDatabase.id, enrichmentSessionId, message);
      if (!response.success || !response.data) {
        toast.error(response.error?.message || "Unable to send message");
        return;
      }
      // Deep-merge new extracted_updates into accumulated updates.
      // When the LLM is asking a clarification question (needs_clarification=true)
      // it intentionally leaves incomplete/empty metrics out of extracted_updates,
      // so we skip the merge in that case to avoid writing partial data.
      const needsClarification = response.data.needs_clarification === true;
      if (!needsClarification) {
        const incoming = response.data.extracted_updates || {};
        setEnrichmentUpdates((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(incoming)) {
            if (key in next && typeof next[key] === "object" && !Array.isArray(next[key]) && typeof value === "object" && !Array.isArray(value)) {
              next[key] = { ...(next[key] as Record<string, any>), ...(value as Record<string, any>) };
            } else if (key in next && Array.isArray(next[key]) && Array.isArray(value)) {
              const existingTerms = new Set((next[key] as any[]).filter(i => i?.term).map((i: any) => i.term));
              const newItems = (value as any[]).filter(i => !existingTerms.has(i?.term));
              next[key] = [...(next[key] as any[]), ...newItems];
            } else {
              next[key] = value;
            }
          }
          return next;
        });
      }
      setEnrichmentChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: response.data.assistant_message || "Noted.",
        },
      ]);
    } catch (error: any) {
      toast.error(error.message || "Unable to send message");
    } finally {
      setIsEnrichmentReplyPending(false);
      setIsEnriching(false);
    }
  };

  const handleApplyEnrichment = async () => {
    if (!selectedDatabase || !enrichmentSessionId) return;
    setIsEnriching(true);
    try {
      // Send empty answers — the backend uses the session's accumulated updates from chat
      // (stored in session.answers_json.updates) as the authoritative source.
      // Sending enrichmentUpdates as flat strings ([object Object]) overwrites the
      // correctly-typed nested dicts the backend already has from the chat phase.
      const response = await applyOntologyEnrichment(selectedDatabase.id, enrichmentSessionId, []);
      if (!response.success || !response.data) {
        toast.error(response.error?.message || "Unable to apply enrichment");
        return;
      }
      setCurrentOntology(response.data);
      setEnrichChatOpen(false);

      // Surface any metric formula validation issues so the user knows their
      // business metric was rejected because it referenced a non-existent column.
      const metricWarnings = (response.data as any)?.metric_warnings as
        | Array<{ metric_name: string; missing_columns: string[]; formula: string }>
        | undefined;
      if (metricWarnings && metricWarnings.length > 0) {
        for (const w of metricWarnings) {
          toast.error(
            `Metric "${w.metric_name}" was dropped: column(s) ${w.missing_columns
              .map((c) => `"${c}"`)
              .join(", ")} do not exist in your schema. Formula: ${w.formula}`,
            { duration: 12000 }
          );
        }
        toast.success(
          `Ontology saved with ${metricWarnings.length} metric(s) skipped. Re-enrich with valid column names to include them.`
        );
      } else {
        toast.success("Ontology enriched successfully");
      }
    } catch (error: any) {
      toast.error(error.message || "Unable to apply enrichment");
    } finally {
      setIsEnriching(false);
    }
  };

  const handleEditConnection = (db: DatabaseConnection) => {
    setSelectedDatabase(db);
    setConnectionName(db.name);
    const normalizedType = (db.rawType || db.type || '').toLowerCase();
    if (normalizedType === 'postgres' || normalizedType === 'postgresql') {
      setDbType('postgresql');
    } else if (normalizedType === 'mysql') {
      setDbType('mysql');
    } else if (normalizedType === 'oracledb' || normalizedType === 'oracle') {
      setDbType('oracledb');
    } else if (normalizedType === 'salesforce') {
      setDbType('salesforce');
    } else if (normalizedType === 'databricks') {
      setDbType('databricks');
    } else {
      setDbType(normalizedType || 'postgresql');
    }
    setHost(db.host);
    setEditDialogOpen(true);
  };

  const handleUpdateConnection = async () => {
    if (!connectionName.trim() || !host.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!selectedDatabase) {
      toast.error("No connection selected");
      return;
    }

    setIsUpdatingConnection(true);
    try {
      const normalizedType =
        dbType === "postgresql"
          ? "postgres"
          : dbType === "oracle"
            ? "oracledb"
            : dbType === "oracledb"
              ? "oracledb"
              : dbType === "mysql"
                ? "mysql"
                : dbType === "databricks"
                  ? "databricks"
                  : dbType;

      const response = await updateConnection(selectedDatabase.id, {
        connection_name: connectionName,
        db_type: normalizedType,
        db_host_link: host,
      });

      if (response.success) {
        toast.success("Database connection updated successfully");
        if (projectId) {
          await fetchDatabases();
        }
        setEditDialogOpen(false);
      } else {
        toast.error(response.error?.message || "Failed to update connection");
      }
    } catch (error: any) {
      toast.error(error.message || "An error occurred while updating the connection");
    } finally {
      setIsUpdatingConnection(false);
      // Reset form
      setConnectionName("");
      setHost("");
      setSelectedDatabase(null);
    }
  };

  const handleDeleteConnection = async (db: DatabaseConnection) => {
    try {
      const response = await deleteConnection(db.id);

      if (response.success) {
        // Remove from local state
        setDatabases(databases.filter(d => d.id !== db.id));
        toast.success(`Connection "${db.name}" deleted successfully`);

        // Refresh the database list to ensure consistency
        if (projectId) {
          fetchDatabases();
        }
      } else {
        toast.error(response.error?.message || `Failed to delete connection "${db.name}"`);
      }
    } catch (error: any) {
      toast.error(error.message || `An error occurred while deleting connection "${db.name}"`);
    }
  };

  const handleConnectionFlowCancel = () => {
    setShowConnectionFlow(false);
  };
  if (showConnectionFlow) {
    return (
      <div className="min-h-full bg-background">
        <DatabaseConnectionFlow
          projectId={projectId ? String(projectId) : undefined}
          onComplete={handleConnectionFlowComplete}
          onCancel={handleConnectionFlowCancel}
        />
      </div>
    );
  }

  return (
    <div className="px-12 py-10">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl text-foreground mb-1">Database Connections</h2>
            <p className="text-muted-foreground">Manage your database connections</p>
          </div>
          <GradientButton
            onClick={() => setShowConnectionFlow(true)}
            className="shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Connection
          </GradientButton>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Check className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">
                  {databases.filter(db => db.status === 'connected').length}
                </p>
                <p className="text-sm text-muted-foreground">Active Connections</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <X className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">
                  {databases.filter(db => db.status === 'error' || db.status === 'disconnected').length}
                </p>
                <p className="text-sm text-muted-foreground">Connection Errors</p>
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Database className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl text-foreground mb-1">{databases.length}</p>
                <p className="text-sm text-muted-foreground">Total Databases</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Databases Table */}
        <Card className="border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading databases...
                  </TableCell>
                </TableRow>
              ) : databases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No database connections found. Click "Add Connection" to get started.
                  </TableCell>
                </TableRow>
              ) : (
                databases.map((db) => (
                  <TableRow key={db.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md">
                          <Database className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-foreground">{db.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border">
                        {db.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{db.host}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={db.status === 'connected' ? 'connected' : 'disconnected'}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{db.lastChecked}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewDSGraph(db)}>
                            <Database className="w-4 h-4 mr-2" />
                            View DS Graph
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewConnection(db)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditConnection(db)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Connection
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteConnection(db)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Connection
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Database Connection Flow */}
        {/* View Connection Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Connection Details</DialogTitle>
              <DialogDescription>
                View database connection information
              </DialogDescription>
            </DialogHeader>

            {selectedDatabase && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Connection Name</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.name}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Database Type</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.type}
                    </div>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <Label>Host</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.host}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      <Badge
                        className={
                          selectedDatabase.status === 'connected'
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }
                      >
                        {selectedDatabase.status === 'connected' ? (
                          <Check className="w-3 h-3 mr-1" />
                        ) : (
                          <X className="w-3 h-3 mr-1" />
                        )}
                        {selectedDatabase.status}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Last Checked</Label>
                    <div className="p-3 rounded-md bg-muted/30 border border-border">
                      {selectedDatabase.lastChecked}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Connection Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Database Connection</DialogTitle>
              <DialogDescription>
                Update your database connection settings
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-connectionName">
                    Connection Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-connectionName"
                    placeholder="prod-analytics-db"
                    value={connectionName}
                    onChange={(e) => setConnectionName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dbType">
                    Database Type <span className="text-destructive">*</span>
                  </Label>
                  <Select value={dbType} onValueChange={setDbType}>
                    <SelectTrigger id="edit-dbType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="oracledb">Oracle</SelectItem>
                      <SelectItem value="databricks">Databricks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-host">
                    Host <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-host"
                    placeholder="localhost or db.example.com"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <GradientButton
                onClick={handleUpdateConnection}
                disabled={isUpdatingConnection}
              >
                <Database className="w-4 h-4 mr-2" />
                {isUpdatingConnection ? "Updating..." : "Update Connection"}
              </GradientButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={dsGraphDialogOpen} onOpenChange={(open) => {
          setDsGraphDialogOpen(open);
          if (!open) {
            setShowTour(false);
          }
        }}>
          <DialogContent
            className="!w-[92vw] !max-w-[92vw] sm:!max-w-[92vw] h-[88vh] max-h-[88vh] p-4 flex flex-col overflow-hidden"
            style={{ width: "92vw", maxWidth: "92vw", height: "88vh", maxHeight: "88vh" }}
            data-tour-container="ds-graph-dialog"
            hideCloseButton={showTour}
            onInteractOutside={(event) => {
              if (showTour) {
                event.preventDefault();
              }
            }}
            onPointerDownOutside={(event) => {
              if (showTour) {
                event.preventDefault();
              }
            }}
            onEscapeKeyDown={(event) => {
              if (showTour) {
                event.preventDefault();
              }
            }}
          >
            <div className="flex items-start justify-between pr-8">
              <DialogHeader>
                <DialogTitle>Datasource Graph</DialogTitle>
                <DialogDescription>
                  {selectedDatabase ? `Visual schema graph for ${selectedDatabase.name}` : "Visual schema graph"}
                </DialogDescription>
              </DialogHeader>
              <GradientButton
                onClick={() => selectedDatabase && handleEnrichDatasource(selectedDatabase)}
                data-tour-target="enrich-datasource-btn"
              >
                Enrich Datasource
              </GradientButton>
            </div>
            {isGraphLoading ? (
              <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">Loading graph...</div>
            ) : graphError ? (
              <div className="flex-1 min-h-0 flex items-center justify-center text-destructive">{graphError}</div>
            ) : currentGraph ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <DSGraphViewer graph={currentGraph} />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">Graph not available.</div>
            )}

            {/* Guided onboarding tour – rendered inside the dialog so
                react-joyride's portal sits above it */}
            <OnboardingTour
              run={showTour}
              onTourEnd={(outcome: TourOutcome) => {
                setShowTour(false);
                if (outcome === 'skipped') {
                  // Fully reset: close the DS Graph dialog to restore
                  // the pre-tour state (databases list view)
                  setDsGraphDialogOpen(false);
                  setCurrentGraph(null);
                  setSelectedDatabase(null);
                }
                // 'finished' → keep DS Graph dialog open, no extra action
              }}
            />
          </DialogContent>
        </Dialog>

        {/* ── Ontology Explorer Dialog ── */}
        <Dialog open={ontologyDialogOpen} onOpenChange={setOntologyDialogOpen}>
          <DialogContent
            className="!w-[92vw] !max-w-[92vw] sm:!max-w-[92vw] h-[88vh] max-h-[88vh] p-4 flex flex-col overflow-hidden"
            style={{ width: "92vw", maxWidth: "92vw", height: "88vh", maxHeight: "88vh" }}
          >
            <div className="flex items-start justify-between pr-8 shrink-0">
              <DialogHeader>
                <DialogTitle>Ontology Explorer</DialogTitle>
                <DialogDescription>
                  {selectedDatabase
                    ? `Knowledge graph ontology for ${selectedDatabase.name}`
                    : "Knowledge graph ontology"}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pbit"
                  hidden
                  ref={fileInputRef}
                  onChange={handlePbitFileChange}
                />
                <Button
                  variant="outline"
                  onClick={handlePbitUploadClick}
                  disabled={isPbitUploading || isOntologyLoading || !currentOntology}
                >
                  {isPbitUploading ? "Importing..." : "Upload .PBIT File"}
                </Button>
                <Button variant="outline" onClick={() => setOntologyDialogOpen(false)}>
                  Close
                </Button>
                <Button variant="outline" onClick={handleDownloadOntologyTTL} disabled={isOntologyLoading || !currentOntology}>
                  Download RDF/OWL
                </Button>
                <GradientButton onClick={handleStartEnriching} disabled={isEnriching || isOntologyLoading || !currentOntology}>
                  {isEnriching ? "Preparing..." : "Start Enriching"}
                </GradientButton>
              </div>
            </div>
            {isOntologyLoading ? (
              <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                <span className="text-sm">Loading ontology…</span>
              </div>
            ) : ontologyError ? (
              <div className="flex-1 min-h-0 flex items-center justify-center text-destructive text-sm">
                {ontologyError}
              </div>
            ) : currentOntology ? (
              <div className="flex-1 min-h-0 overflow-hidden">
                <OntologyViewer ontology={currentOntology} />
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground text-sm">
                Ontology not available.
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={enrichChatOpen} onOpenChange={setEnrichChatOpen}>
          <DialogContent
            className="!w-[98vw] !max-w-[98vw] sm:!max-w-[98vw] h-[90vh] max-h-[90vh] flex flex-col"
            style={{ width: "98vw", maxWidth: "98vw", height: "90vh", maxHeight: "90vh" }}
          >
            <DialogHeader>
              <DialogTitle>Ontology Enrichment Chat</DialogTitle>
              <DialogDescription>
                Chat with the assistant to enrich business semantics for this ontology.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 min-h-0 gap-3 overflow-hidden">
              {/* Chat area */}
              <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-2">
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                  {enrichmentChat.map((msg, index) => (
                    <div
                      key={`${msg.role}-${index}`}
                      className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                        msg.role === "assistant"
                          ? "bg-muted/40 border border-border mr-10"
                          : "bg-primary/10 border border-primary/20 ml-10"
                      }`}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isEnrichmentReplyPending && (
                    <div className="rounded-lg px-3 py-2 text-sm bg-muted/40 border border-border mr-10" aria-live="polite" aria-busy="true">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-primary/80" />
                        <span className="text-xs text-muted-foreground">Capturing metrics...</span>
                        <span className="flex items-center gap-1" aria-hidden>
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                              style={{ animationDelay: `${i * 140}ms` }}
                            />
                          ))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <Input
                    placeholder="Type your answer or business rule..."
                    value={enrichmentInput}
                    onChange={(e) => setEnrichmentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendEnrichmentMessage();
                      }
                    }}
                    disabled={isEnriching}
                  />
                  <Button onClick={handleSendEnrichmentMessage} disabled={isEnriching || !enrichmentInput.trim()}>
                    Send
                  </Button>
                </div>
              </div>

              {/* Captured so far panel */}
              <div className="w-80 shrink-0 flex flex-col rounded-lg border border-border bg-muted/20 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border shrink-0">
                  <p className="text-xs font-semibold text-foreground">Captured so far</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Updated as you chat</p>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
                  {Object.keys(enrichmentUpdates).length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center pt-4">
                      Nothing captured yet. Start chatting to define metrics, granularity, and rules.
                    </p>
                  )}

                  {/* Metrics */}
                  {enrichmentUpdates.metrics && Object.keys(enrichmentUpdates.metrics).length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mb-1.5">
                        <TrendingUp className="w-3 h-3" /> Metrics
                      </p>
                      <div className="space-y-2">
                        {Object.entries(enrichmentUpdates.metrics).map(([name, val]: [string, any]) => (
                          <div key={name} className="rounded border border-border/50 bg-background/40 p-2">
                            <p className="text-[11px] font-semibold text-foreground">{name}</p>
                            {val?.formula && (
                              <code className="block text-[10px] text-emerald-400 font-mono mt-1 break-all">
                                {val.formula}
                              </code>
                            )}
                            {typeof val === "string" && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{val}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rules */}
                  {enrichmentUpdates.rules && Object.keys(enrichmentUpdates.rules).length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 mb-1.5">
                        <Clock className="w-3 h-3" /> Rules
                      </p>
                      <div className="rounded border border-border/50 bg-background/40 divide-y divide-border/40">
                        {enrichmentUpdates.rules.default_time_granularity && (
                          <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-[10px] text-muted-foreground">Granularity</span>
                            <span className="text-[10px] font-semibold text-sky-300 capitalize">
                              {enrichmentUpdates.rules.default_time_granularity}
                            </span>
                          </div>
                        )}
                        {enrichmentUpdates.rules.default_time_dimension && (
                          <div className="flex items-center justify-between px-2 py-1.5">
                            <span className="text-[10px] text-muted-foreground">Date Column</span>
                            <code className="text-[10px] font-mono text-sky-300">
                              {enrichmentUpdates.rules.default_time_dimension}
                            </code>
                          </div>
                        )}
                        {enrichmentUpdates.rules.status_success_values?.length > 0 && (
                          <div className="px-2 py-1.5">
                            <span className="text-[10px] text-muted-foreground">Success values</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {enrichmentUpdates.rules.status_success_values.map((v: string) => (
                                <span key={v} className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">{v}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Aliases */}
                  {enrichmentUpdates.aliases?.length > 0 && (
                    <div>
                      <p className="flex items-center gap-1 text-[10px] font-semibold text-violet-400 mb-1.5">
                        <Tag className="w-3 h-3" /> Aliases
                      </p>
                      <div className="rounded border border-border/50 bg-background/40 divide-y divide-border/40">
                        {enrichmentUpdates.aliases.map((a: any, i: number) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1.5">
                            <span className="text-[10px] text-violet-300">"{a.term}"</span>
                            <span className="text-[9px] text-muted-foreground">→</span>
                            <code className="text-[10px] font-mono text-foreground">{a.maps_to}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 shrink-0">
              <Button variant="outline" onClick={() => setEnrichChatOpen(false)} disabled={isEnriching}>
                Close
              </Button>
              <GradientButton onClick={handleApplyEnrichment} disabled={isEnriching || !enrichmentSessionId}>
                {isEnriching ? "Applying..." : "Apply Enrichment"}
              </GradientButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
