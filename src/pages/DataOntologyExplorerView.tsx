import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BookOpen,
  Bot,
  ChevronDown,
  Clock,
  Download,
  Search,
  Star,
  Tag,
  TrendingUp,
  Upload,
  Database,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Columns3,
  ChevronUp,
  Pencil,
  Sparkles,
  LayoutList,
  LayoutGrid,
  History,
  Eye,
  Table2,
  Link2,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { GradientButton } from "../components/shared/GradientButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { toast } from "sonner";
import {
  getDatabases,
  getLatestOntology,
  bootstrapOntology,
  downloadLatestOntologyTTL,
  startOntologyEnrichment,
  sendOntologyEnrichmentChat,
  applyOntologyEnrichment,
  uploadPbitFile,
  type OntologyVersionPayload,
} from "../services/api";

// ─── Local types ────────────────────────────────────────────────────────────

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
}

interface OntologyColumn {
  physical_name: string;
  semantic_type?: string;
  business_definition?: string;
  status?: string;
  data_type?: string;
  confidence?: number;
  updated_by?: string;
}

interface OntologyTable {
  physical_name: string;
  category?: string;
  description?: string;
  status?: string;
  is_ai_generated?: boolean;
  columns?: OntologyColumn[];
  last_updated?: string;
  updated_by?: string;
  owner?: string;
  data_steward?: string;
  business_purpose?: string;
  business_concepts?: string[];
  common_questions?: string[];
  ai_confidence?: number;
  tags?: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<{
  id: string;
  label: string;
  dot: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "all",              label: "All Tables",       dot: "bg-primary",        Icon: Table2 },
  { id: "PENDING",          label: "Pending Review",   dot: "bg-amber-400",      Icon: AlertCircle },
  { id: "APPROVED",         label: "Approved",         dot: "bg-emerald-400",    Icon: CheckCircle2 },
  { id: "REJECTED",         label: "Rejected",         dot: "bg-red-400",        Icon: XCircle },
  { id: "ai_generated",     label: "AI Generated",     dot: "bg-blue-400",       Icon: Sparkles },
  { id: "human_edited",     label: "Human Edited",     dot: "bg-violet-400",     Icon: Pencil },
  { id: "recently_updated", label: "Recently Updated", dot: "bg-sky-400",        Icon: Clock },
  { id: "favorites",        label: "Favorites",        dot: "bg-yellow-400",     Icon: Star },
];

function statusBg(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "PENDING" || s === "PENDING_REVIEW") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (s === "REJECTED") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-blue-500/15 text-blue-400 border-blue-500/30";
}

function statusLabel(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return "Approved";
  if (s === "PENDING" || s === "PENDING_REVIEW") return "Pending Review";
  if (s === "REJECTED") return "Rejected";
  return status || "AI Generated";
}

function semanticTypeBg(type?: string) {
  const t = (type || "").toLowerCase();
  if (t === "metric") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (t === "dimension") return "bg-sky-500/10 text-sky-400 border-sky-500/20";
  if (t === "identifier" || t === "pk") return "bg-violet-500/10 text-violet-400 border-violet-500/20";
  if (t === "reference" || t === "fk") return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (t === "descriptive") return "bg-slate-500/10 text-slate-300 border-slate-500/20";
  return "bg-muted/40 text-muted-foreground border-border";
}

function confidenceColor(val: number) {
  if (val >= 90) return "bg-emerald-500";
  if (val >= 70) return "bg-amber-400";
  return "bg-red-400";
}

function relativeTime(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border/40 bg-card/60 animate-pulse shadow-sm">
      <div className="flex items-start gap-3 px-3.5 pt-2.5 pb-2.5">
        <div className="w-8 h-8 rounded-md bg-muted/40 shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <div className="h-3 w-28 rounded bg-muted/50" />
            <div className="h-4 w-16 rounded-full bg-muted/40" />
            <div className="h-2.5 w-24 rounded bg-muted/30" />
          </div>
          <div className="h-2.5 w-full rounded bg-muted/35" />
          <div className="h-2.5 w-4/5 rounded bg-muted/30" />
          <div className="flex gap-1.5 mt-1">
            <div className="h-4 w-12 rounded-full bg-muted/30" />
            <div className="h-4 w-16 rounded-full bg-muted/30" />
            <div className="h-4 w-14 rounded-full bg-muted/30" />
          </div>
          <div className="flex gap-4 mt-1">
            <div className="h-2.5 w-16 rounded bg-muted/30" />
            <div className="h-2.5 w-16 rounded bg-muted/30" />
          </div>
        </div>
        <div className="w-4 h-4 rounded bg-muted/30 shrink-0 mt-0.5" />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

interface DataOntologyExplorerViewProps {
  projectId?: string | number;
}

export function DataOntologyExplorerView({ projectId }: DataOntologyExplorerViewProps) {
  // ── Datasource selection ──
  const [databases, setDatabases] = useState<DatabaseConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<DatabaseConnection | null>(null);
  const [dbsLoading, setDbsLoading] = useState(false);

  // ── Ontology data ──
  const [ontology, setOntology] = useState<OntologyVersionPayload | null>(null);
  const [ontologyLoading, setOntologyLoading] = useState(false);
  const [ontologyError, setOntologyError] = useState<string | null>(null);

  // ── UI filters / selection ──
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [rightPanelTab, setRightPanelTab] = useState<"overview" | "columns" | "relationships" | "history">("overview");
  const [sortOrder, setSortOrder] = useState<"recently_updated" | "name_az" | "status">("recently_updated");

  // ── Enrichment chat ──
  const [enrichChatOpen, setEnrichChatOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichmentSessionId, setEnrichmentSessionId] = useState<string | null>(null);
  const [enrichmentInput, setEnrichmentInput] = useState("");
  const [enrichmentChat, setEnrichmentChat] = useState<Array<{ role: "assistant" | "user"; text: string }>>([]);
  const [isEnrichmentReplyPending, setIsEnrichmentReplyPending] = useState(false);
  const [enrichmentUpdates, setEnrichmentUpdates] = useState<Record<string, any>>({});

  // ── PBIT ──
  const [isPbitUploading, setIsPbitUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // ─── Parse tables from ontology ────────────────────────────────────────────
  const ontologyTables: OntologyTable[] = (() => {
    if (!ontology) return [];
    const raw = ontology.ontology ?? {};
    if (Array.isArray(raw.tables)) return raw.tables as OntologyTable[];
    return (ontology.graph?.nodes ?? []).map((n) => ({
      physical_name: n.label,
      category: n.meta?.category as string | undefined,
      description: n.meta?.description as string | undefined,
      status: n.meta?.status as string | undefined,
      columns: [],
    }));
  })();

  // ─── Derived stats ──────────────────────────────────────────────────────────
  const stats = {
    tables: ontologyTables.length,
    columns: ontologyTables.reduce((acc, t) => acc + (t.columns?.length ?? 0), 0),
    pending: ontologyTables.filter((t) => ["PENDING", "PENDING_REVIEW"].includes((t.status || "").toUpperCase())).length,
    approved: ontologyTables.filter((t) => (t.status || "").toUpperCase() === "APPROVED").length,
    rejected: ontologyTables.filter((t) => (t.status || "").toUpperCase() === "REJECTED").length,
  };

  const categories = Array.from(new Set(ontologyTables.map((t) => t.category).filter(Boolean) as string[])).sort();

  // ─── Filtered + sorted tables ──────────────────────────────────────────────
  const filteredTables = (() => {
    let list = ontologyTables.filter((table) => {
      const q = searchQuery.trim().toLowerCase();
      const sq = sidebarSearch.trim().toLowerCase();
      const searchQ = q || sq;
      if (searchQ) {
        const nameMatch = table.physical_name.toLowerCase().includes(searchQ);
        const descMatch = (table.description || "").toLowerCase().includes(searchQ);
        const colMatch = (table.columns || []).some(
          (c) => c.physical_name.toLowerCase().includes(searchQ) || (c.business_definition || "").toLowerCase().includes(searchQ)
        );
        if (!nameMatch && !descMatch && !colMatch) return false;
      }
      if (statusFilter === "PENDING") return ["PENDING", "PENDING_REVIEW"].includes((table.status || "").toUpperCase());
      if (statusFilter === "APPROVED") return (table.status || "").toUpperCase() === "APPROVED";
      if (statusFilter === "REJECTED") return (table.status || "").toUpperCase() === "REJECTED";
      if (statusFilter === "ai_generated") return !!table.is_ai_generated;
      if (statusFilter === "human_edited") return !table.is_ai_generated && !!table.description;
      if (statusFilter === "recently_updated") return !!table.last_updated;
      if (statusFilter === "favorites") return favorites.has(table.physical_name);
      if (domainFilter !== "all") return table.category === domainFilter;
      return true;
    });

    if (sortOrder === "name_az") list = [...list].sort((a, b) => a.physical_name.localeCompare(b.physical_name));
    else if (sortOrder === "status") list = [...list].sort((a, b) => (a.status || "").localeCompare(b.status || ""));
    return list;
  })();

  const selectedTable = ontologyTables.find((t) => t.physical_name === selectedTableName) ?? null;

  // ─── Count by filter ────────────────────────────────────────────────────────
  const countFor = (id: string) => {
    if (id === "all") return ontologyTables.length;
    if (id === "PENDING") return ontologyTables.filter((t) => ["PENDING", "PENDING_REVIEW"].includes((t.status || "").toUpperCase())).length;
    if (id === "APPROVED") return ontologyTables.filter((t) => (t.status || "").toUpperCase() === "APPROVED").length;
    if (id === "REJECTED") return ontologyTables.filter((t) => (t.status || "").toUpperCase() === "REJECTED").length;
    if (id === "ai_generated") return ontologyTables.filter((t) => t.is_ai_generated).length;
    if (id === "human_edited") return ontologyTables.filter((t) => !t.is_ai_generated && !!t.description).length;
    if (id === "recently_updated") return ontologyTables.filter((t) => !!t.last_updated).length;
    if (id === "favorites") return favorites.size;
    return 0;
  };

  // ─── Fetch databases ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    setDbsLoading(true);
    getDatabases(String(projectId))
      .then((res) => {
        if (res.success && res.data) {
          const mapped = res.data.map((db) => ({ id: db.id, name: db.name, type: db.type }));
          setDatabases(mapped);
          const savedId = localStorage.getItem(`vizai_ontology_db_${projectId}`);
          const restored = mapped.find((d) => d.id === savedId) ?? mapped[0] ?? null;
          if (restored) setSelectedDb(restored);
        }
      })
      .finally(() => setDbsLoading(false));
  }, [projectId]);

  // ─── Load ontology when DB selected ────────────────────────────────────────
  const loadOntology = useCallback(async (db: DatabaseConnection) => {
    setOntologyLoading(true);
    setOntologyError(null);
    setOntology(null);
    setSelectedTableName(null);
    setExpandedTables(new Set());
    try {
      let res = await getLatestOntology(db.id);
      if (!res.success || !res.data) res = await bootstrapOntology(db.id);
      if (res.success && res.data) setOntology(res.data);
      else setOntologyError(res.error?.message || "Unable to load ontology");
    } catch (err: any) {
      setOntologyError(err.message || "Unable to load ontology");
    } finally {
      setOntologyLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDb) {
      if (projectId) localStorage.setItem(`vizai_ontology_db_${projectId}`, selectedDb.id);
      loadOntology(selectedDb);
    }
  }, [selectedDb, loadOntology, projectId]);

  useEffect(() => {
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [enrichmentChat, isEnrichmentReplyPending]);

  // ─── Enrichment handlers ────────────────────────────────────────────────────
  const handleStartEnriching = async () => {
    if (!selectedDb) return;
    setIsEnriching(true);
    try {
      const res = await startOntologyEnrichment(selectedDb.id);
      if (!res.success || !res.data) { toast.error(res.error?.message || "Unable to start enrichment"); return; }
      setEnrichmentSessionId(res.data.session_id);
      setEnrichmentUpdates({});
      setEnrichmentChat([{ role: "assistant", text: res.data.initial_message || "Let's enrich your ontology. Share business rules, default metrics, and status definitions." }]);
      setEnrichChatOpen(true);
    } catch (err: any) { toast.error(err.message || "Unable to start enrichment"); }
    finally { setIsEnriching(false); }
  };

  const handleSendEnrichmentMessage = async () => {
    if (!selectedDb || !enrichmentSessionId) return;
    const message = enrichmentInput.trim();
    if (!message) return;
    setEnrichmentInput("");
    setEnrichmentChat((prev) => [...prev, { role: "user", text: message }]);
    setIsEnriching(true);
    setIsEnrichmentReplyPending(true);
    try {
      const res = await sendOntologyEnrichmentChat(selectedDb.id, enrichmentSessionId, message);
      if (!res.success || !res.data) { toast.error(res.error?.message || "Unable to send message"); return; }
      const needsClarification = res.data.needs_clarification === true;
      if (!needsClarification) {
        const incoming = res.data.extracted_updates || {};
        setEnrichmentUpdates((prev) => {
          const next = { ...prev };
          for (const [key, value] of Object.entries(incoming)) {
            if (key in next && typeof next[key] === "object" && !Array.isArray(next[key]) && typeof value === "object" && !Array.isArray(value)) {
              next[key] = { ...(next[key] as Record<string, any>), ...(value as Record<string, any>) };
            } else if (key in next && Array.isArray(next[key]) && Array.isArray(value)) {
              const existingTerms = new Set((next[key] as any[]).filter((i) => i?.term).map((i: any) => i.term));
              const newItems = (value as any[]).filter((i) => !existingTerms.has(i?.term));
              next[key] = [...(next[key] as any[]), ...newItems];
            } else { next[key] = value; }
          }
          return next;
        });
      }
      setEnrichmentChat((prev) => [...prev, { role: "assistant", text: res.data.assistant_message || "Noted." }]);
    } catch (err: any) { toast.error(err.message || "Unable to send message"); }
    finally { setIsEnrichmentReplyPending(false); setIsEnriching(false); }
  };

  const handleApplyEnrichment = async () => {
    if (!selectedDb || !enrichmentSessionId) return;
    setIsEnriching(true);
    try {
      const res = await applyOntologyEnrichment(selectedDb.id, enrichmentSessionId, []);
      if (!res.success || !res.data) { toast.error(res.error?.message || "Unable to apply enrichment"); return; }
      setOntology(res.data);
      setEnrichChatOpen(false);
      const metricWarnings = (res.data as any)?.metric_warnings as Array<{ metric_name: string; missing_columns: string[]; formula: string }> | undefined;
      if (metricWarnings && metricWarnings.length > 0) {
        for (const w of metricWarnings) toast.error(`Metric "${w.metric_name}" was dropped: column(s) ${w.missing_columns.map((c) => `"${c}"`).join(", ")} do not exist.`, { duration: 12000 });
        toast.success(`Ontology saved with ${metricWarnings.length} metric(s) skipped.`);
      } else toast.success("Ontology enriched successfully");
    } catch (err: any) { toast.error(err.message || "Unable to apply enrichment"); }
    finally { setIsEnriching(false); }
  };

  const handleDownloadTTL = async () => {
    if (!selectedDb) return;
    try {
      const res = await downloadLatestOntologyTTL(selectedDb.id);
      if (!res.success || !res.data) { toast.error(res.error?.message || "Unable to download"); return; }
      const blob = new Blob([res.data], { type: "text/turtle;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${selectedDb.name || "ontology"}.ttl`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      toast.success("Ontology file downloaded");
    } catch (err: any) { toast.error(err.message || "Unable to download"); }
  };

  const handlePbitUploadClick = () => { if (fileInputRef.current) { fileInputRef.current.value = ""; fileInputRef.current.click(); } };

  const handlePbitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDb) return;
    if (!file.name.toLowerCase().endsWith(".pbit")) { toast.error("Only .pbit files are supported."); return; }
    setIsPbitUploading(true);
    try {
      const res = await uploadPbitFile(selectedDb.id, file);
      if (!res.success || !res.data) { toast.error(res.error?.message || "Failed to import .pbit file"); return; }
      toast.success("Business metrics imported successfully.");
      const refreshed = await getLatestOntology(selectedDb.id);
      if (refreshed.success && refreshed.data) setOntology(refreshed.data);
    } catch (err: any) { toast.error(err.message || "Failed to import .pbit file"); }
    finally { setIsPbitUploading(false); }
  };

  const toggleExpanded = (name: string) => {
    setExpandedTables((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  };
  const toggleFavorite = (name: string) => {
    setFavorites((prev) => { const next = new Set(prev); if (next.has(name)) next.delete(name); else next.add(name); return next; });
  };

  // ─── Guards ─────────────────────────────────────────────────────────────────
  if (!projectId) return <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Select a project to view the Data Ontology Explorer.</div>;
  if (dbsLoading) return <div className="h-full flex items-center justify-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading databases…</div>;
  if (databases.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
      <Database className="w-9 h-9 opacity-40" />
      <p className="text-sm font-medium">No database connections found.</p>
      <p className="text-xs opacity-70">Connect a database from the Databases tab first.</p>
    </div>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-background text-foreground">

      {/* ── Hidden PBIT file input ── */}
      <input type="file" accept=".pbit" hidden ref={fileInputRef} onChange={handlePbitFileChange} />

      {/* ══════════════ HEADER BAR ══════════════ */}
      <header className="shrink-0 flex items-center gap-5 px-6 py-3 border-b border-border bg-card/70 backdrop-blur">
        {/* Title */}
        <div className="min-w-0 pl-1">
          <h1 className="text-[13px] font-semibold text-foreground leading-snug tracking-tight">Catalog Explorer</h1>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">
            AI-powered semantic catalog for{" "}
            {databases.length === 1
              ? <span className="text-foreground/70">{selectedDb?.name ?? "—"}</span>
              : (
                <select
                  className="ml-0.5 text-[11px] rounded border border-border bg-transparent text-foreground/70 px-1 py-0 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  value={selectedDb?.id ?? ""}
                  onChange={(e) => { const db = databases.find((d) => d.id === e.target.value); if (db) setSelectedDb(db); }}
                >
                  {databases.map((db) => <option key={db.id} value={db.id}>{db.name}</option>)}
                </select>
              )}
          </p>
        </div>

        <div className="flex-1" />

        {/* Global search */}
        <div className="relative w-[420px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            className="w-full h-8 pl-8 pr-3 text-[11px] rounded-md border border-border bg-muted/20 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50"
            placeholder="Search tables, columns, business terms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <div className={isPbitUploading ? "pbit-glow-btn" : undefined} style={isPbitUploading ? { display: "inline-flex", isolation: "isolate" } : undefined}>
            <Button variant="outline" size="sm" onClick={handlePbitUploadClick}
              disabled={isPbitUploading || ontologyLoading || !ontology} className="h-7 gap-1.5 text-[11px] px-2.5"
              style={isPbitUploading ? { background: "linear-gradient(135deg,rgba(129,140,248,.15),rgba(34,211,238,.1))", borderColor: "rgba(129,140,248,.6)", color: "#a5b4fc", pointerEvents: "none" } : undefined}>
              <Upload className="w-3 h-3" />
              {isPbitUploading ? "Importing…" : "Upload .PBIT File"}
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadTTL}
            disabled={ontologyLoading || !ontology} className="h-7 gap-1.5 text-[11px] px-2.5">
            <Download className="w-3 h-3" />
            Download RDF/OWL
          </Button>
          <GradientButton onClick={handleStartEnriching}
            disabled={isEnriching || ontologyLoading || !ontology || isPbitUploading}>
            <span className="flex items-center gap-1.5 text-[11px]">
              <Sparkles className="w-3 h-3" />
              {isEnriching ? "Preparing…" : "Start Enriching"}
            </span>
          </GradientButton>
        </div>
      </header>

      {/* ══════════════ THREE-COLUMN BODY ══════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ──────────── LEFT SIDEBAR (280px) ──────────── */}
        <aside className="w-[200px] shrink-0 flex flex-col border-r border-border bg-card/50 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto py-3">

            {/* Status filter list */}
            <div className="px-1.5 space-y-px">
              {STATUS_FILTERS.map((f) => {
                const count = countFor(f.id);
                const isActive = statusFilter === f.id && domainFilter === "all";
                return (
                  <button
                    key={f.id}
                    onClick={() => { setStatusFilter(f.id); setDomainFilter("all"); }}
                    className={`w-full flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-sm text-left transition-colors border-l-2 ${
                      isActive
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    <span className={`shrink-0 ${isActive ? "text-primary" : "text-muted-foreground/50"}`}>
                      <f.Icon className="w-3 h-3" />
                    </span>
                    <span className="flex-1 text-[11px] truncate">{f.label}</span>
                    <span className={`text-[10px] tabular-nums shrink-0 ${isActive ? "text-primary font-semibold" : "text-muted-foreground/60"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Domain filters */}
            {categories.length > 0 && (
              <div className="mt-3 pt-2.5 border-t border-border/40 px-1.5">
                <p className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-2 mb-1">Filter by Domain</p>
                <div className="space-y-px">
                  {categories.map((cat) => {
                    const isActive = domainFilter === cat;
                    const cnt = ontologyTables.filter((t) => t.category === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setDomainFilter(cat); setStatusFilter("all"); }}
                        className={`w-full flex items-center justify-between pl-2 pr-2.5 py-1.5 rounded-sm text-left text-[11px] transition-colors border-l-2 ${
                          isActive ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground/80"
                        }`}
                      >
                        <span className="truncate">{cat}</span>
                        <span className="ml-1 shrink-0 tabular-nums text-[10px] text-muted-foreground/60">{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ──────────── CENTER PANEL (flex-1) ──────────── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden border-r border-border">

          {/* ── Stats row ── */}
          <div className="shrink-0 flex items-stretch border-b border-border bg-card/20">
            {[
              { label: "Tables",        sub: "Total",            value: stats.tables,   icon: <Database className="w-3.5 h-3.5" />,     color: "text-primary",       iconBg: "bg-primary/10 text-primary" },
              { label: "Columns",       sub: "Total",            value: stats.columns,  icon: <Columns3 className="w-3.5 h-3.5" />,     color: "text-sky-400",       iconBg: "bg-sky-500/10 text-sky-400" },
              { label: "Pending Review",sub: "AI Generated",     value: stats.pending,  icon: <Clock className="w-3.5 h-3.5" />,        color: "text-amber-400",     iconBg: "bg-amber-500/10 text-amber-400" },
              { label: "Approved",      sub: "Human Verified",   value: stats.approved, icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "text-emerald-400",   iconBg: "bg-emerald-500/10 text-emerald-400" },
              { label: "Rejected",      sub: "Needs Attention",  value: stats.rejected, icon: <XCircle className="w-3.5 h-3.5" />,     color: "text-red-400",       iconBg: "bg-red-500/10 text-red-400" },
            ].map((s, i, arr) => (
              <div
                key={s.label}
                className={`flex items-center gap-2.5 flex-1 px-3.5 py-2.5 ${i < arr.length - 1 ? "border-r border-border/40" : ""}`}
              >
                <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${s.iconBg}`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className={`text-[15px] font-bold leading-none tabular-nums ${s.color}`}>
                    {ontologyLoading
                      ? <span className="inline-block w-5 h-3.5 rounded bg-muted/40 animate-pulse align-middle" />
                      : s.value.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-foreground/70 font-medium leading-snug mt-0.5 truncate">{s.label}</p>
                  <p className="text-[9px] text-muted-foreground/60 leading-snug truncate">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Center sub-toolbar: search + sort + view ── */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border bg-card/20">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <input
                className="w-full h-7 pl-7 pr-3 text-[11px] rounded border border-border bg-muted/20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="Search tables..."
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground ml-auto">
              <span className="shrink-0">Sort by:</span>
              <select
                className="h-7 text-[11px] rounded border border-border bg-muted/20 text-foreground px-1.5 focus:outline-none focus:ring-1 focus:ring-primary/50"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
              >
                <option value="recently_updated">Recently Updated</option>
                <option value="name_az">Name (A–Z)</option>
                <option value="status">Status</option>
              </select>
            </div>
            <div className="flex items-center rounded border border-border overflow-hidden">
              <button className="p-1.5 bg-primary/15 text-primary border-r border-border" title="List view">
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors" title="Grid view">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* ── Scrollable table cards ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">

            {ontologyLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

            {ontologyError && !ontologyLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
                <XCircle className="w-7 h-7" />
                <p className="text-sm">{ontologyError}</p>
                <Button variant="outline" size="sm" onClick={() => selectedDb && loadOntology(selectedDb)}>Retry</Button>
              </div>
            )}

            {!ontologyLoading && !ontologyError && filteredTables.length === 0 && ontology && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <BookOpen className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">No tables match your filters.</p>
                <p className="text-xs opacity-70">Try clearing the search or changing the filter.</p>
              </div>
            )}

            {!ontologyLoading && !ontologyError && filteredTables.map((table) => {
              const isExpanded = expandedTables.has(table.physical_name);
              const isSelected = selectedTableName === table.physical_name;
              const isFav = favorites.has(table.physical_name);
              const colCount = table.columns?.length ?? 0;
              const timeAgo = relativeTime(table.last_updated);

              return (
                <div
                  key={table.physical_name}
                  className={`rounded-lg border shadow-sm transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-primary/50 bg-primary/[0.04] shadow-primary/5"
                      : "border-border/60 bg-card/80 hover:border-border hover:shadow-md hover:bg-card/90"
                  }`}
                  onClick={() => { setSelectedTableName(table.physical_name); setRightPanelTab("overview"); }}
                >
                  {/* ── Card header ── */}
                  <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-2">
                    {/* Table icon */}
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 border ${
                      isSelected ? "bg-primary/15 border-primary/30" : "bg-muted/25 border-border/40"
                    }`}>
                      <Table2 className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground/70"}`} />
                    </div>

                    {/* Name + badges + meta */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: name, star, badge, timestamp */}
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="text-[13px] font-semibold text-foreground leading-tight">{table.physical_name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(table.physical_name); }}
                          className="text-muted-foreground/30 hover:text-yellow-400 transition-colors"
                        >
                          <Star className={`w-3 h-3 ${isFav ? "text-yellow-400 fill-yellow-400" : ""}`} />
                        </button>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-[18px] leading-none rounded-full border ${statusBg(table.status)}`}>
                          {statusLabel(table.status)}
                        </Badge>
                        {timeAgo && (
                          <span className="text-[10px] text-muted-foreground/50">
                            • Updated {timeAgo}{table.updated_by ? ` by ${table.updated_by}` : ""}
                          </span>
                        )}
                      </div>

                      {/* Row 2: description — always shown, placeholder if missing */}
                      <p className="text-[11px] text-muted-foreground/70 mt-1 leading-relaxed line-clamp-2">
                        {table.description || <span className="italic opacity-40">No description yet — use Start Enriching to generate AI descriptions.</span>}
                      </p>

                      {/* Row 3: tags */}
                      {(table.tags && table.tags.length > 0) ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {table.tags.map((tag) => (
                            <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border/50 font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      ) : table.category ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/30 text-muted-foreground border border-border/40 font-medium">
                            #{table.category}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Col/relation count + expand chevron */}
                    <div className="shrink-0 flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap tabular-nums">
                        {colCount} Columns
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap tabular-nums">
                        0 Relations
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(table.physical_name); }}
                        className={`p-1 rounded transition-colors ${
                          isExpanded ? "text-primary" : "text-muted-foreground/50 hover:text-foreground"
                        }`}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* ── Expanded column grid ── */}
                  {isExpanded && (
                    <div className="border-t border-border/50">
                      {(table.columns ?? []).length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="bg-muted/20 border-b border-border/40">
                                {["Column Name", "AI Description", "Type", "Tag", "Confidence", "Status", "Actions"].map((h) => (
                                  <th key={h} className="text-left text-[9px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1.5 whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                              {(table.columns ?? []).map((col) => {
                                const conf = col.confidence;
                                const isPK = (col.semantic_type || "").toLowerCase() === "identifier" || (col.semantic_type || "").toLowerCase() === "pk";
                                return (
                                  <tr key={col.physical_name} className="hover:bg-muted/10 transition-colors group">
                                    <td className="px-3 py-2 font-mono text-[10px] text-foreground whitespace-nowrap align-middle">
                                      <div className="flex items-center gap-1">
                                        {isPK && <span className="text-[8px] px-1 py-0 rounded bg-violet-500/20 text-violet-400 border border-violet-500/30 font-bold leading-4">PK</span>}
                                        {col.physical_name}
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-muted-foreground align-middle max-w-[200px]">
                                      <span className="line-clamp-2 leading-relaxed">{col.business_definition || <span className="italic opacity-40">No description</span>}</span>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-muted-foreground align-middle whitespace-nowrap">
                                      {col.data_type || "—"}
                                    </td>
                                    <td className="px-3 py-2 align-middle">
                                      {col.semantic_type ? (
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 leading-none ${semanticTypeBg(col.semantic_type)}`}>
                                          {col.semantic_type}
                                        </Badge>
                                      ) : <span className="text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-2 align-middle min-w-[80px]">
                                      {conf !== undefined ? (
                                        <div className="flex items-center gap-1.5">
                                          <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden min-w-[48px]">
                                            <div className={`h-full rounded-full transition-all ${confidenceColor(conf)}`} style={{ width: `${conf}%` }} />
                                          </div>
                                          <span className="text-[9px] tabular-nums text-muted-foreground">{conf}%</span>
                                        </div>
                                      ) : <span className="text-[10px] text-muted-foreground/40">—</span>}
                                    </td>
                                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 leading-none ${statusBg(col.status)}`}>
                                        {statusLabel(col.status)}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 align-middle whitespace-nowrap">
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {(col.status || "").toUpperCase() === "PENDING" || (col.status || "").toUpperCase() === "PENDING_REVIEW" ? (
                                          <>
                                            <button className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500/60 hover:text-emerald-400 transition-colors" title="Approve">
                                              <CheckCircle2 className="w-3 h-3" />
                                            </button>
                                            <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground/50 hover:text-foreground transition-colors" title="Edit">
                                              <Pencil className="w-3 h-3" />
                                            </button>
                                          </>
                                        ) : null}
                                        <button className="p-1 rounded hover:bg-muted/40 text-muted-foreground/40 hover:text-foreground transition-colors" title="More actions">
                                          <MoreHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="px-4 py-3 text-[11px] text-muted-foreground/60 text-center italic">No column data available.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* ──────────── RIGHT DETAILS PANEL (380px) ──────────── */}
        <aside className="w-[380px] shrink-0 flex flex-col overflow-hidden bg-card/40">
          {selectedTable ? (
            <div className="flex flex-col h-full min-h-0">

              {/* Panel header */}
              <div className="px-4 pt-3 pb-2.5 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-muted/30 border border-border/50 flex items-center justify-center shrink-0">
                      <Table2 className="w-3.5 h-3.5 text-muted-foreground/80" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{selectedTable.physical_name}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">Table</p>
                    </div>
                  </div>
                  <button onClick={() => toggleFavorite(selectedTable.physical_name)} className="p-1 rounded hover:bg-muted/40 transition-colors shrink-0 mt-0.5">
                    <Star className={`w-3.5 h-3.5 ${favorites.has(selectedTable.physical_name) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400"}`} />
                  </button>
                </div>
                {/* Status badge row */}
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className={`text-[10px] px-2 py-0.5 rounded-full cursor-pointer ${statusBg(selectedTable.status)}`}>
                    {statusLabel(selectedTable.status)} ▾
                  </Badge>
                  {selectedTable.is_ai_generated && (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> AI Generated
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border shrink-0 bg-card/30 px-1 pt-1">
                {[
                  { id: "overview" as const, label: "Overview" },
                  { id: "columns" as const, label: `Columns (${selectedTable.columns?.length ?? 0})` },
                  { id: "relationships" as const, label: "Relationships (0)" },
                  { id: "history" as const, label: "History" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setRightPanelTab(tab.id)}
                    className={`px-3 py-2 text-[11px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                      rightPanelTab === tab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Scrollable body */}
              <div className="flex-1 min-h-0 overflow-y-auto">

                {/* ── Overview tab ── */}
                {rightPanelTab === "overview" && (
                  <div className="p-4 space-y-3.5">

                    {/* AI Generated Description */}
                    <section>
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="text-[11px] font-semibold text-foreground/80">AI Generated Description</h3>
                        <button className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors">
                          <Pencil className="w-2.5 h-2.5" /> Edit
                        </button>
                      </div>
                      <p className="text-[12px] text-foreground/70 leading-relaxed">
                        {selectedTable.description
                          ? selectedTable.description
                          : `Table with ${selectedTable.columns?.length ?? 0} column${selectedTable.columns?.length === 1 ? "" : "s"}.`}
                      </p>
                    </section>

                    {/* Business Purpose */}
                    <section>
                      <h3 className="text-[11px] font-semibold text-foreground/80 mb-1.5">Business Purpose</h3>
                      {selectedTable.business_purpose ? (
                        <p className="text-[12px] text-foreground/60 leading-relaxed">{selectedTable.business_purpose}</p>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="h-2.5 rounded bg-muted/35 w-full animate-pulse" />
                          <div className="h-2.5 rounded bg-muted/25 w-4/5 animate-pulse" />
                          <p className="text-[10px] text-muted-foreground/35 italic mt-1">Use Start Enriching to define business purpose.</p>
                        </div>
                      )}
                    </section>

                    {/* Business Concepts */}
                    <section>
                      <h3 className="text-[11px] font-semibold text-foreground/80 mb-1.5">Business Concepts</h3>
                      {selectedTable.business_concepts && selectedTable.business_concepts.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedTable.business_concepts.map((concept, i) => {
                            const colors = [
                              "bg-sky-500/10 text-sky-400 border-sky-500/20",
                              "bg-violet-500/10 text-violet-400 border-violet-500/20",
                              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                              "bg-orange-500/10 text-orange-400 border-orange-500/20",
                            ];
                            return (
                              <Badge key={concept} variant="outline" className={`text-[10px] px-2 py-0.5 rounded-md ${colors[i % colors.length]}`}>
                                {concept}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {[56, 48, 64, 52].map((w, i) => (
                            <div key={i} className="h-5 rounded-md bg-muted/25 animate-pulse" style={{ width: `${w}px` }} />
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Common Business Questions */}
                    <section>
                      <h3 className="text-[11px] font-semibold text-foreground/80 mb-1.5">Common Business Questions</h3>
                      {selectedTable.common_questions && selectedTable.common_questions.length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedTable.common_questions.map((q) => (
                            <li key={q} className="flex items-start gap-2 text-[11px] text-foreground/60 leading-relaxed">
                              <span className="shrink-0 mt-1.5">•</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="space-y-2">
                          {[90, 75, 82].map((w, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="shrink-0 text-muted-foreground/30 text-[11px]">•</span>
                              <div className="h-2.5 rounded bg-muted/25 animate-pulse" style={{ width: `${w}%` }} />
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* ── Divider before metadata ── */}
                    <hr className="border-border/40" />

                    {/* Metadata block */}
                    <div className="space-y-2.5">
                      {/* Domain */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/70 shrink-0">Domain</span>
                        {selectedTable.category ? (
                          <span className="text-[12px] text-foreground/80 font-medium">{selectedTable.category}</span>
                        ) : (
                          <div className="h-2.5 w-16 rounded bg-muted/30 animate-pulse" />
                        )}
                      </div>

                      {/* Tags */}
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/70 shrink-0 mt-0.5">Tags</span>
                        {selectedTable.tags && selectedTable.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-end">
                            {selectedTable.tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] leading-none rounded-full bg-muted/30 text-muted-foreground border-border/50">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            {[40, 52, 44].map((w, i) => <div key={i} className="h-[18px] rounded-full bg-muted/25 animate-pulse" style={{ width: `${w}px` }} />)}
                          </div>
                        )}
                      </div>

                      {/* Owner */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/70 shrink-0">Owner</span>
                        {selectedTable.owner ? (
                          <span className="text-[12px] text-foreground/80">{selectedTable.owner}</span>
                        ) : (
                          <div className="h-2.5 w-20 rounded bg-muted/30 animate-pulse" />
                        )}
                      </div>

                      {/* Data Steward */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/70 shrink-0">Data Steward</span>
                        {selectedTable.data_steward ? (
                          <span className="text-[12px] text-primary/80 hover:text-primary cursor-pointer transition-colors">{selectedTable.data_steward}</span>
                        ) : (
                          <div className="h-2.5 w-20 rounded bg-muted/30 animate-pulse" />
                        )}
                      </div>

                      {/* Created */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/70 shrink-0">Created</span>
                        {selectedTable.last_updated ? (
                          <span className="text-[12px] text-foreground/70">
                            {new Date(selectedTable.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        ) : (
                          <div className="h-2.5 w-20 rounded bg-muted/30 animate-pulse" />
                        )}
                      </div>

                      {/* Last Updated */}
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground/70 shrink-0">Last Updated</span>
                        {selectedTable.last_updated ? (
                          <span className="text-[12px] text-foreground/70">
                            {relativeTime(selectedTable.last_updated)}{selectedTable.updated_by ? ` by ${selectedTable.updated_by}` : ""}
                          </span>
                        ) : (
                          <div className="h-2.5 w-24 rounded bg-muted/30 animate-pulse" />
                        )}
                      </div>

                      {/* AI Confidence */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[11px] text-muted-foreground/70">AI Confidence (Overall)</span>
                          {typeof selectedTable.ai_confidence === "number" ? (
                            <span className="text-[12px] font-semibold text-emerald-400 tabular-nums">{selectedTable.ai_confidence}%</span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40 italic">–</span>
                          )}
                        </div>
                        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                          {typeof selectedTable.ai_confidence === "number" ? (
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${confidenceColor(selectedTable.ai_confidence)}`}
                              style={{ width: `${selectedTable.ai_confidence}%` }}
                            />
                          ) : (
                            <div className="h-full rounded-full bg-muted/40 animate-pulse w-3/4" />
                          )}
                        </div>
                        {typeof selectedTable.ai_confidence !== "number" && (
                          <p className="text-[9px] text-muted-foreground/35 italic mt-1">Confidence calculated after enrichment</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Columns tab ── */}
                {rightPanelTab === "columns" && (
                  <div className="p-4">
                    {(selectedTable.columns ?? []).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-8">No column data available.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {(selectedTable.columns ?? []).map((col) => (
                          <div key={col.physical_name} className="flex items-start justify-between gap-2 p-2 rounded-md border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors">
                            <div className="min-w-0">
                              <p className="text-[11px] font-mono text-foreground truncate">{col.physical_name}</p>
                              {col.business_definition && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{col.business_definition}</p>}
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1">
                              {col.semantic_type && (
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 leading-none ${semanticTypeBg(col.semantic_type)}`}>
                                  {col.semantic_type}
                                </Badge>
                              )}
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 leading-none ${statusBg(col.status)}`}>
                                {statusLabel(col.status)}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Relationships tab ── */}
                {rightPanelTab === "relationships" && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                    <Link2 className="w-6 h-6 opacity-30" />
                    <p className="text-[11px]">No relationships mapped yet.</p>
                  </div>
                )}

                {/* ── History tab ── */}
                {rightPanelTab === "history" && (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                    <History className="w-6 h-6 opacity-30" />
                    <p className="text-[11px]">No history available.</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border shrink-0">
                <Button variant="outline" size="sm" className="w-full text-[11px] gap-1.5 h-8"
                  onClick={() => { if (!expandedTables.has(selectedTable.physical_name)) toggleExpanded(selectedTable.physical_name); }}>
                  <Eye className="w-3.5 h-3.5" />
                  View Technical Details
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center">
                <BookOpen className="w-5 h-5 opacity-40" />
              </div>
              <div>
                <p className="text-xs font-medium">Select a table</p>
                <p className="text-[10px] mt-1 opacity-60">Click any table to view its details here.</p>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* ══════════════ ENRICHMENT CHAT DIALOG ══════════════ */}
      <Dialog open={enrichChatOpen} onOpenChange={setEnrichChatOpen}>
        <DialogContent
          className="!w-[98vw] !max-w-[98vw] sm:!max-w-[98vw] h-[90vh] max-h-[90vh] flex flex-col"
          style={{ width: "98vw", maxWidth: "98vw", height: "90vh", maxHeight: "90vh" }}
        >
          <DialogHeader>
            <DialogTitle>Ontology Enrichment Chat</DialogTitle>
            <DialogDescription>Chat with the assistant to enrich business semantics for this ontology.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-1 min-h-0 gap-3 overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 min-w-0 gap-2">
              <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                {enrichmentChat.map((msg, index) => (
                  <div key={`${msg.role}-${index}`}
                    className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === "assistant" ? "bg-muted/40 border border-border mr-10" : "bg-primary/10 border border-primary/20 ml-10"}`}>
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
                          <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input placeholder="Type your answer or business rule..."
                  value={enrichmentInput}
                  onChange={(e) => setEnrichmentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSendEnrichmentMessage(); } }}
                  disabled={isEnriching}
                />
                <Button onClick={handleSendEnrichmentMessage} disabled={isEnriching || !enrichmentInput.trim()}>Send</Button>
              </div>
            </div>
            <div className="w-80 shrink-0 flex flex-col rounded-lg border border-border bg-muted/20 overflow-hidden">
              <div className="px-3 py-2.5 border-b border-border shrink-0">
                <p className="text-xs font-semibold text-foreground">Captured so far</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Updated as you chat</p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
                {Object.keys(enrichmentUpdates).length === 0 && (
                  <p className="text-[11px] text-muted-foreground text-center pt-4">Nothing captured yet. Start chatting to define metrics, granularity, and rules.</p>
                )}
                {enrichmentUpdates.metrics && Object.keys(enrichmentUpdates.metrics).length > 0 && (
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 mb-1.5"><TrendingUp className="w-3 h-3" /> Metrics</p>
                    <div className="space-y-2">
                      {Object.entries(enrichmentUpdates.metrics).map(([name, val]: [string, any]) => (
                        <div key={name} className="rounded border border-border/50 bg-background/40 p-2">
                          <p className="text-[11px] font-semibold text-foreground">{name}</p>
                          {val?.formula && <code className="block text-[10px] text-emerald-400 font-mono mt-1 break-all">{val.formula}</code>}
                          {typeof val === "string" && <p className="text-[10px] text-muted-foreground mt-0.5">{val}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {enrichmentUpdates.rules && Object.keys(enrichmentUpdates.rules).length > 0 && (
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-sky-400 mb-1.5"><Clock className="w-3 h-3" /> Rules</p>
                    <div className="rounded border border-border/50 bg-background/40 divide-y divide-border/40">
                      {enrichmentUpdates.rules.default_time_granularity && (
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="text-[10px] text-muted-foreground">Granularity</span>
                          <span className="text-[10px] font-semibold text-sky-300 capitalize">{enrichmentUpdates.rules.default_time_granularity}</span>
                        </div>
                      )}
                      {enrichmentUpdates.rules.default_time_dimension && (
                        <div className="flex items-center justify-between px-2 py-1.5">
                          <span className="text-[10px] text-muted-foreground">Date Column</span>
                          <code className="text-[10px] font-mono text-sky-300">{enrichmentUpdates.rules.default_time_dimension}</code>
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
                {enrichmentUpdates.aliases?.length > 0 && (
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-semibold text-violet-400 mb-1.5"><Tag className="w-3 h-3" /> Aliases</p>
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
            <Button variant="outline" onClick={() => setEnrichChatOpen(false)} disabled={isEnriching}>Close</Button>
            <GradientButton onClick={handleApplyEnrichment} disabled={isEnriching || !enrichmentSessionId}>
              {isEnriching ? "Applying…" : "Apply Enrichment"}
            </GradientButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
