import React, { useState, useEffect, useCallback, useRef, Fragment } from "react";
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
  Loader2,
  Columns3,
  Pencil,
  Check,
  Sparkles,
  Wand2,
  History,
  Eye,
  Table2,
  Briefcase,
  Filter,
  ListChecks,
  CalendarClock,
  RefreshCw,
  ArrowRight,
  X,
  BadgeCheck,
  CircleX,
  FileText,
  Brain,
  Info,
  ShieldCheck,
  Clock3,
  Building2,
  User,
  CalendarDays,
  ArrowUpRight,
  ArrowDownLeft,
  Network,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { GradientButton } from "../components/shared/GradientButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
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
  syncOntologyDatasource,
  getOntologySyncStatus,
  getOntologyCategories,
  getOntologyTables,
  getOntologyTableColumns,
  generateOntologyTableDescription,
  generateOntologyColumnDescription,
  updateOntologyTable,
  updateOntologyColumn,
  getOntologyBusinessMetrics,
  getDatabaseDSGraph,
  downloadLatestOntologyTTL,
  startOntologyEnrichment,
  sendOntologyEnrichmentChat,
  applyOntologyEnrichment,
  uploadPbitFile,
  type OntologyVersionPayload,
  type OntologySyncStatus,
  type OntologyTableSummary,
  type OntologyBusinessMetric,
} from "../services/api";

// ─── Local types ────────────────────────────────────────────────────────────

interface DatabaseConnection {
  id: string;
  name: string;
  type: string;
  status?: string;
  environment?: string;
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
  column_count?: number;
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

// Resolves the effective category for a table strictly from backend data — the
// AI-generated `category` field returned by the catalog enrichment pipeline.
// We never fabricate or infer a category client-side: if the backend hasn't
// generated one yet, this returns undefined and the table is simply excluded
// from category-based filtering/grouping until it has real data.
function resolveCategory(table: { category?: string }): string | undefined {
  const explicit = table.category?.trim();
  return explicit && explicit.length > 0 ? explicit : undefined;
}

const STATUS_FILTERS: Array<{
  id: string;
  label: string;
  color: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "all",              label: "All Tables",       color: "text-primary",      Icon: Database },
  { id: "PENDING",          label: "Pending Review",   color: "text-amber-400",    Icon: Clock },
  { id: "APPROVED",         label: "Approved",         color: "text-emerald-400",  Icon: BadgeCheck },
  { id: "REJECTED",         label: "Rejected",         color: "text-red-400",      Icon: CircleX },
  { id: "ai_generated",     label: "AI Generated",     color: "text-blue-400",     Icon: Sparkles },
  { id: "human_edited",     label: "Human Edited",     color: "text-violet-400",   Icon: Pencil },
  { id: "recently_updated", label: "Recently Updated", color: "text-sky-400",      Icon: History },
  { id: "favorites",        label: "Favorites",        color: "text-yellow-400",   Icon: Star },
];

// Inline color tokens — Tailwind opacity utilities are unreliable in this
// build; use explicit rgba so badges always render with distinct colors.
type BadgeTone = { backgroundColor: string; color: string; borderColor: string };

function statusStyle(status?: string): BadgeTone {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") {
    return { backgroundColor: "rgba(16,185,129,0.22)", color: "#6EE7B7", borderColor: "rgba(52,211,153,0.55)" };
  }
  if (s === "PENDING" || s === "PENDING_REVIEW" || s === "NEEDS_REVIEW" || s === "COMPLETED") {
    return { backgroundColor: "rgba(245,158,11,0.22)", color: "#FCD34D", borderColor: "rgba(251,191,36,0.55)" };
  }
  if (s === "REJECTED") {
    return { backgroundColor: "rgba(239,68,68,0.22)", color: "#FCA5A5", borderColor: "rgba(248,113,113,0.55)" };
  }
  if (s === "GENERATING") {
    return { backgroundColor: "rgba(14,165,233,0.22)", color: "#7DD3FC", borderColor: "rgba(56,189,248,0.55)" };
  }
  if (s === "QUEUED") {
    return { backgroundColor: "rgba(148,163,184,0.14)", color: "#CBD5E1", borderColor: "rgba(148,163,184,0.35)" };
  }
  if (s === "HUMAN_EDITED" || s === "HUMAN EDITED") {
    return { backgroundColor: "rgba(59,130,246,0.22)", color: "#93C5FD", borderColor: "rgba(96,165,250,0.55)" };
  }
  // AI Generated / default
  return { backgroundColor: "rgba(139,92,246,0.22)", color: "#C4B5FD", borderColor: "rgba(167,139,250,0.55)" };
}

function statusLabel(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "APPROVED") return "Approved";
  if (s === "PENDING" || s === "PENDING_REVIEW" || s === "COMPLETED") return "Pending Review";
  if (s === "REJECTED") return "Rejected";
  if (s === "NEEDS_REVIEW") return "Needs Review";
  if (s === "GENERATING") return "Generating…";
  if (s === "QUEUED") return "Queued";
  if (s === "HUMAN_EDITED" || s === "HUMAN EDITED") return "Human Edited";
  return status || "AI Generated";
}

function StatusBadge({ status, className = "" }: { status?: string; className?: string }) {
  const s = (status || "").toUpperCase();
  const tone = statusStyle(status);
  const Icon =
    s === "APPROVED" ? CheckCircle2
    : s === "REJECTED" ? XCircle
    : s === "PENDING" || s === "PENDING_REVIEW" || s === "NEEDS_REVIEW" || s === "COMPLETED" ? Clock
    : s === "HUMAN_EDITED" || s === "HUMAN EDITED" ? Pencil
    : s === "GENERATING" ? Loader2
    : Sparkles;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium leading-none border transition-colors duration-150 ${s === "GENERATING" ? "animate-pulse" : ""} ${className}`}
      style={{
        backgroundColor: tone.backgroundColor,
        color: tone.color,
        borderColor: tone.borderColor,
        padding: "5px 12px",
        height: 26,
        fontSize: 14,
      }}
    >
      <Icon className={`w-3 h-3 shrink-0 ${s === "GENERATING" ? "animate-spin" : ""}`} strokeWidth={2} style={{ color: tone.color }} />
      {statusLabel(status)}
    </span>
  );
}

function semanticTypeStyle(type?: string): BadgeTone {
  const t = (type || "").toLowerCase();
  if (t === "identifier" || t === "pk" || t === "primary key") {
    return { backgroundColor: "rgba(139,92,246,0.18)", color: "#C4B5FD", borderColor: "rgba(167,139,250,0.5)" };
  }
  if (t === "descriptive" || t === "attribute") {
    return { backgroundColor: "rgba(59,130,246,0.18)", color: "#93C5FD", borderColor: "rgba(96,165,250,0.5)" };
  }
  if (t === "metric" || t === "measure") {
    return { backgroundColor: "rgba(249,115,22,0.18)", color: "#FDBA74", borderColor: "rgba(251,146,60,0.5)" };
  }
  if (t === "dimension") {
    return { backgroundColor: "rgba(16,185,129,0.18)", color: "#6EE7B7", borderColor: "rgba(52,211,153,0.5)" };
  }
  if (t === "date" || t === "datetime" || t === "timestamp") {
    return { backgroundColor: "rgba(6,182,212,0.18)", color: "#67E8F9", borderColor: "rgba(34,211,238,0.5)" };
  }
  if (t === "reference" || t === "fk" || t === "foreign key") {
    return { backgroundColor: "rgba(14,165,233,0.18)", color: "#7DD3FC", borderColor: "rgba(56,189,248,0.5)" };
  }
  if (t === "boolean" || t === "bool") {
    return { backgroundColor: "rgba(236,72,153,0.18)", color: "#F9A8D4", borderColor: "rgba(244,114,182,0.5)" };
  }
  if (t === "enum") {
    return { backgroundColor: "rgba(99,102,241,0.18)", color: "#A5B4FC", borderColor: "rgba(129,140,248,0.5)" };
  }
  return { backgroundColor: "rgba(148,163,184,0.12)", color: "#CBD5E1", borderColor: "rgba(148,163,184,0.35)" };
}

// Confidence values from the LLM service may arrive as a 0-1 fraction or a
// 0-100 percentage depending on the code path; normalize to 0-100 for display.
function toConfidencePct(val?: number | null): number | null {
  if (typeof val !== "number" || Number.isNaN(val)) return null;
  const pct = val <= 1 ? val * 100 : val;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

function confidenceBarHex(val: number) {
  if (val >= 95) return "#10B981";
  if (val >= 80) return "#FBBF24";
  if (val >= 60) return "#F59E0B";
  return "#F87171";
}

function confidenceTextHex(val: number) {
  if (val >= 95) return "#6EE7B7";
  if (val >= 80) return "#FCD34D";
  if (val >= 60) return "#FBBF24";
  return "#FCA5A5";
}

function dataTypeBadge(type?: string): { label: string; style: BadgeTone } | null {
  const t = (type || "").toLowerCase();
  if (t.includes("int") || t.includes("serial") || t.includes("number")) {
    return { label: type || "integer", style: { backgroundColor: "rgba(59,130,246,0.18)", color: "#93C5FD", borderColor: "rgba(96,165,250,0.5)" } };
  }
  if (t.includes("char") || t.includes("text") || t.includes("string") || t.includes("uuid")) {
    return { label: type || "varchar", style: { backgroundColor: "rgba(139,92,246,0.18)", color: "#C4B5FD", borderColor: "rgba(167,139,250,0.5)" } };
  }
  if (t.includes("date") || t.includes("time")) {
    return { label: type || "date", style: { backgroundColor: "rgba(249,115,22,0.18)", color: "#FDBA74", borderColor: "rgba(251,146,60,0.5)" } };
  }
  if (t.includes("bool")) {
    return { label: type || "boolean", style: { backgroundColor: "rgba(16,185,129,0.18)", color: "#6EE7B7", borderColor: "rgba(52,211,153,0.5)" } };
  }
  if (t.includes("decimal") || t.includes("numeric") || t.includes("float") || t.includes("double") || t.includes("money")) {
    return { label: type || "decimal", style: { backgroundColor: "rgba(6,182,212,0.18)", color: "#67E8F9", borderColor: "rgba(34,211,238,0.5)" } };
  }
  if (!type) return null;
  return { label: type, style: { backgroundColor: "rgba(148,163,184,0.14)", color: "#CBD5E1", borderColor: "rgba(148,163,184,0.35)" } };
}


// Graph nodes carry a semantic `label` (e.g. "Customers" PascalCase, derived by
// the backend's class-naming step) that does NOT match the raw physical table
// name used everywhere else (ontology.tables[i].physical_name). The backend
// preserves the original physical name in `node.meta.table` — use that for any
// matching against physical table names, falling back to `label` defensively.
function nodePhysicalName(n: { label: string; meta?: Record<string, any> }): string {
  return (n.meta?.table as string) || n.label;
}

// ─── Datasource display helpers (aligned with the Databases module) ──────────
function dbTypeLabel(type?: string) {
  const t = (type || "").toLowerCase();
  if (t === "postgresql" || t === "postgres") return "PostgreSQL";
  if (t === "mysql") return "MySQL";
  if (t === "oracledb" || t === "oracle") return "Oracle";
  if (t === "databricks") return "Databricks";
  if (t === "salesforce") return "Salesforce";
  if (t === "spreadsheet") return "Spreadsheet";
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : "Database";
}

function statusDotColor(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "connected") return "bg-emerald-400";
  if (s === "error") return "bg-red-400";
  return "bg-muted-foreground/40";
}

function statusText(status?: string) {
  const s = (status || "").toLowerCase();
  if (s === "connected") return "Connected";
  if (s === "error") return "Error";
  if (s === "disconnected") return "Disconnected";
  return status || "Unknown";
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

// ─── Right-panel presentational helpers ──────────────────────────────────────

function PanelSection({
  icon,
  iconColor,
  title,
  action,
  children,
}: {
  icon: React.ReactNode;
  iconColor?: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-card/70 p-4 shadow-sm transition-colors"
      style={{
        border: "1px solid rgba(255,255,255,0.22)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80">
          <span className={iconColor ?? "text-muted-foreground/70"}>{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetaCard({
  icon,
  iconColor,
  label,
  children,
}: {
  icon: React.ReactNode;
  iconColor?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 px-2.5 py-2 min-w-0">
      <p className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1">
        <span className={iconColor ?? "text-muted-foreground/60"}>{icon}</span>
        {label}
      </p>
      <div className="text-[12px] text-foreground/85 font-medium truncate">{children}</div>
    </div>
  );
}

function RelationshipRow({ dot, name, label }: { dot: string; name: string; label: string }) {
  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/40 bg-muted/10 hover:bg-muted/25 hover:border-border/70 transition-colors cursor-default">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <Table2 className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-[12px] font-medium text-foreground/85 truncate flex-1">{name}</span>
      <span className="text-[9px] text-muted-foreground/60 truncate max-w-[90px]">{label}</span>
      <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0 transition-all group-hover:text-primary group-hover:translate-x-0.5" />
    </div>
  );
}

function EmptyHint({
  text = "No information available.",
  sub = "Generate AI Catalog to enrich this entity.",
}: {
  text?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 px-3 py-3 text-center">
      <p className="text-[11px] text-muted-foreground/70">{text}</p>
      {sub && <p className="text-[10px] text-muted-foreground/40 mt-0.5">{sub}</p>}
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

  // ── Welcome / datasource selection dialog ──
  const [showWelcome, setShowWelcome] = useState(false);
  const [pendingDbId, setPendingDbId] = useState<string>("");

  // ── Ontology data (doc APIs + graph context for relationships) ──
  const [ontologyGraph, setOntologyGraph] = useState<OntologyVersionPayload | null>(null);
  const [tableSummaries, setTableSummaries] = useState<OntologyTableSummary[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, OntologyColumn[]>>({});
  const [categories, setCategories] = useState<string[]>([]);
  const [businessMetrics, setBusinessMetrics] = useState<OntologyBusinessMetric[]>([]);
  const [ontologyLoading, setOntologyLoading] = useState(false);
  const [ontologyError, setOntologyError] = useState<string | null>(null);

  // ── Ontology sync job (POST /sync + poll /sync/status) ──
  const [syncJob, setSyncJob] = useState<OntologySyncStatus | null>(null);
  const [generatingColumn, setGeneratingColumn] = useState<string | null>(null);
  const [generatingTable, setGeneratingTable] = useState<string | null>(null);

  // ── Raw schema preview (table/column counts from the actual DB schema graph),
  // used only to show a real "estimated time" on the pre-generation onboarding
  // card — never fabricated. ──
  const [schemaPreview, setSchemaPreview] = useState<{ tables: number; columns: number } | null>(null);

  // ── UI filters / selection ──
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedTableName, setSelectedTableName] = useState<string | null>(null);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [rightPanelTab, setRightPanelTab] = useState<"overview" | "columns" | "relationships" | "history">("overview");
  const [sortOrder, setSortOrder] = useState<"recently_updated" | "name_az" | "status">("recently_updated");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  // ── Top-level view (Catalog Explorer vs Business Context) ──
  const [activeView, setActiveView] = useState<"catalog" | "business_context">("catalog");

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

  // ─── Parse tables from doc API summaries + loaded columns ─────────────────
  const ontologyTables: OntologyTable[] = tableSummaries.map((summary) => ({
    physical_name: summary.physical_name,
    category: summary.category,
    description: summary.description ?? undefined,
    status: summary.status,
    is_ai_generated: summary.is_ai_generated,
    ai_confidence: summary.confidence ?? undefined,
    business_purpose: summary.business_purpose ?? undefined,
    business_concepts: summary.business_concepts ?? undefined,
    common_questions: summary.common_questions ?? undefined,
    last_updated: summary.last_updated ?? undefined,
    tags: summary.tags ?? undefined,
    column_count: summary.column_count ?? undefined,
    columns: columnsByTable[summary.physical_name] ?? [],
  }));

  // ─── Derived stats ──────────────────────────────────────────────────────────
  const stats = {
    tables: ontologyTables.length,
    columns: ontologyTables.reduce(
      (acc, t) => acc + (t.columns?.length || t.column_count || 0),
      0
    ),
    pending: ontologyTables.filter((t) => ["PENDING", "PENDING_REVIEW", "NEEDS_REVIEW", "COMPLETED"].includes((t.status || "").toUpperCase())).length,
    approved: ontologyTables.filter((t) => (t.status || "").toUpperCase() === "APPROVED").length,
    rejected: ontologyTables.filter((t) => (t.status || "").toUpperCase() === "REJECTED").length,
  };

  // ─── Ontology sync summary ─────────────────────────────────────────────────
  const schemaEstimate = schemaPreview
    ? { tables: schemaPreview.tables, columns: schemaPreview.columns, seconds: Math.max(5, Math.round(schemaPreview.tables * 4)) }
    : null;
  const catalogTotalRelationships = ontologyGraph?.graph?.edges?.length ?? 0;
  const catalogAvgConfidencePct = toConfidencePct(
    tableSummaries.length
      ? tableSummaries.reduce((acc, t) => acc + (t.confidence ?? 0), 0) / tableSummaries.length
      : null
  );
  const catalogGeneratedAt: string | undefined = syncJob?.completed_at ?? undefined;

  const hasCatalog =
    syncJob?.status === "completed" ||
    ontologyTables.some((t) => t.is_ai_generated || !!t.description);

  // Per-table relationship counts, derived once from the graph edges (mirrors
  // the selected-table relationship logic below, but for every visible card).
  const relCountByTable: Record<string, number> = (() => {
    const counts: Record<string, number> = {};
    const nodes = ontologyGraph?.graph?.nodes ?? [];
    const edges = ontologyGraph?.graph?.edges ?? [];
    const idToTable = new Map<string, string>();
    nodes.forEach((n) => idToTable.set(n.id, nodePhysicalName(n)));
    edges.forEach((e) => {
      const sourceTable = idToTable.get(e.source);
      const targetTable = idToTable.get(e.target);
      if (sourceTable) counts[sourceTable] = (counts[sourceTable] ?? 0) + 1;
      if (targetTable) counts[targetTable] = (counts[targetTable] ?? 0) + 1;
    });
    return counts;
  })();

  // Categories from GET /categories (doc API)
  const aiCategories = categories.length > 0
    ? categories
    : Array.from(
        new Set(
          ontologyTables
            .map((t) => resolveCategory(t))
            .filter((c): c is string => !!c)
        )
      ).sort();

  // ─── Filtered + sorted tables ──────────────────────────────────────────────
  const filteredTables = (() => {
    let list = ontologyTables.filter((table) => {
      const searchQ = sidebarSearch.trim().toLowerCase();
      if (searchQ) {
        const nameMatch = table.physical_name.toLowerCase().includes(searchQ);
        const descMatch = (table.description || "").toLowerCase().includes(searchQ);
        const colMatch = (table.columns || []).some(
          (c) => c.physical_name.toLowerCase().includes(searchQ) || (c.business_definition || "").toLowerCase().includes(searchQ)
        );
        if (!nameMatch && !descMatch && !colMatch) return false;
      }
      if (statusFilter === "PENDING") return ["PENDING", "PENDING_REVIEW", "COMPLETED"].includes((table.status || "").toUpperCase());
      if (statusFilter === "APPROVED") return (table.status || "").toUpperCase() === "APPROVED";
      if (statusFilter === "REJECTED") return (table.status || "").toUpperCase() === "REJECTED";
      if (statusFilter === "ai_generated") return !!table.is_ai_generated;
      if (statusFilter === "human_edited") return !table.is_ai_generated && !!table.description;
      if (statusFilter === "recently_updated") return !!table.last_updated;
      if (statusFilter === "favorites") return favorites.has(table.physical_name);
      if (categoryFilter !== "all") return resolveCategory(table) === categoryFilter;
      return true;
    });

    if (sortOrder === "name_az") list = [...list].sort((a, b) => a.physical_name.localeCompare(b.physical_name));
    else if (sortOrder === "status") list = [...list].sort((a, b) => (a.status || "").localeCompare(b.status || ""));
    return list;
  })();

  const selectedTable = ontologyTables.find((t) => t.physical_name === selectedTableName) ?? null;
  const isSelectedTableGenerating = syncJob?.status === "running";

  // ─── Relationships for the selected table (derived from the ontology graph) ──
  const tableRelationships = (() => {
    const empty = { outgoing: [] as Array<{ label: string; target: string }>, incoming: [] as Array<{ label: string; source: string }> };
    if (!selectedTable || !ontologyGraph?.graph) return empty;
    const nodes = ontologyGraph.graph.nodes ?? [];
    const edges = ontologyGraph.graph.edges ?? [];
    const idToTable = new Map<string, string>();
    nodes.forEach((n) => idToTable.set(n.id, nodePhysicalName(n)));
    const selfNode = nodes.find((n) => nodePhysicalName(n) === selectedTable.physical_name);
    if (!selfNode) return empty;
    const outgoing = edges
      .filter((e) => e.source === selfNode.id)
      .map((e) => ({ label: e.label || e.type || "references", target: idToTable.get(e.target) || e.target }));
    const incoming = edges
      .filter((e) => e.target === selfNode.id)
      .map((e) => ({ label: e.label || e.type || "referenced by", source: idToTable.get(e.source) || e.source }));
    return { outgoing, incoming };
  })();
  const relCount = tableRelationships.outgoing.length + tableRelationships.incoming.length;

  // ─── Business context (metrics / rules / aliases) ──────────────────────────
  // Sourced from the persisted, enriched ontology and merged with anything the
  // enrichment chatbot captured during the current session (so it shows up the
  // moment the user submits, even before a fresh ontology fetch).
  const businessContext = (() => {
    const source = (ontologyGraph?.ontology ?? {}) as Record<string, any>;
    const asObject = (v: any) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
    const asArray = (v: any) => (Array.isArray(v) ? v : []);

    const metricsFromApi = Object.fromEntries(
      businessMetrics.map((m) => [m.name, { formula: m.formula, description: m.description, source: m.source, status: m.status }])
    );
    const metrics: Record<string, any> = {
      ...metricsFromApi,
      ...asObject(enrichmentUpdates.metrics),
      ...asObject(source.metrics),
    };
    const rules: Record<string, any> = {
      ...asObject(enrichmentUpdates.rules),
      ...asObject(source.rules),
    };

    const aliasMap = new Map<string, any>();
    [...asArray(enrichmentUpdates.aliases), ...asArray(source.aliases)].forEach((a) => {
      if (a && a.term) aliasMap.set(String(a.term), a);
    });
    const aliases = Array.from(aliasMap.values());

    return { metrics, rules, aliases };
  })();

  const metricEntries = Object.entries(businessContext.metrics);
  const ruleKeys = Object.keys(businessContext.rules);
  const hasBusinessContext =
    metricEntries.length > 0 || ruleKeys.length > 0 || businessContext.aliases.length > 0;

  // ─── Count by filter ────────────────────────────────────────────────────────
  const countFor = (id: string) => {
    if (id === "all") return ontologyTables.length;
    if (id === "PENDING") return ontologyTables.filter((t) => ["PENDING", "PENDING_REVIEW", "COMPLETED"].includes((t.status || "").toUpperCase())).length;
    if (id === "APPROVED") return ontologyTables.filter((t) => (t.status || "").toUpperCase() === "APPROVED").length;
    if (id === "REJECTED") return ontologyTables.filter((t) => (t.status || "").toUpperCase() === "REJECTED").length;
    if (id === "ai_generated") return ontologyTables.filter((t) => t.is_ai_generated).length;
    if (id === "human_edited") return ontologyTables.filter((t) => !t.is_ai_generated && !!t.description).length;
    if (id === "recently_updated") return ontologyTables.filter((t) => !!t.last_updated).length;
    if (id === "favorites") return favorites.size;
    return 0;
  };

  // ─── Fetch datasources (reuses the Databases module API) ─────────────────────
  useEffect(() => {
    if (!projectId) return;
    setDbsLoading(true);
    getDatabases(String(projectId))
      .then((res) => {
        if (res.success && res.data) {
          const mapped: DatabaseConnection[] = res.data.map((db) => ({
            id: db.id,
            name: db.name,
            type: db.type,
            status: db.status,
          }));
          setDatabases(mapped);

          // Same-session revisit: auto-load the datasource chosen earlier this session.
          const sessionId = sessionStorage.getItem(`vizai_ontology_session_db_${projectId}`);
          const sessionDb = mapped.find((d) => d.id === sessionId);
          if (sessionDb) {
            setSelectedDb(sessionDb);
            setShowWelcome(false);
            return;
          }

          // First open this session: pre-select last used (or first) but wait for Continue.
          const savedId = localStorage.getItem(`vizai_ontology_db_${projectId}`);
          const preferred = mapped.find((d) => d.id === savedId) ?? mapped[0] ?? null;
          setPendingDbId(preferred?.id ?? "");
          setShowWelcome(true);
        }
      })
      .finally(() => setDbsLoading(false));
  }, [projectId]);

  const loadTableColumns = useCallback(async (dbId: string, tableName: string) => {
    const res = await getOntologyTableColumns(dbId, tableName);
    if (res.success && res.data) {
      setColumnsByTable((prev) => ({
        ...prev,
        [tableName]: res.data!.columns.map((c) => ({
          physical_name: c.physical_name,
          semantic_type: c.semantic_type,
          business_definition: c.business_definition,
          status: c.status,
          confidence: c.confidence ?? undefined,
          data_type: c.data_type ?? undefined,
        })),
      }));
    }
  }, []);

  const refreshExplorerData = useCallback(async (db: DatabaseConnection) => {
    const [tablesRes, categoriesRes, syncRes, metricsRes, graphRes] = await Promise.all([
      getOntologyTables(db.id),
      getOntologyCategories(db.id),
      getOntologySyncStatus(db.id),
      getOntologyBusinessMetrics(db.id),
      getLatestOntology(db.id),
    ]);

    if (tablesRes.success && tablesRes.data) {
      setTableSummaries(tablesRes.data.tables);
    }
    if (categoriesRes.success && categoriesRes.data) {
      setCategories(categoriesRes.data.categories);
    }
    if (syncRes.success && syncRes.data) {
      setSyncJob(syncRes.data);
    }
    if (metricsRes.success && metricsRes.data) {
      setBusinessMetrics(metricsRes.data.metrics);
    }
    if (graphRes.success && graphRes.data) {
      setOntologyGraph(graphRes.data);
    }
  }, []);

  // ─── Load ontology explorer data for a datasource (doc APIs) ───────────────
  const loadOntology = useCallback(async (db: DatabaseConnection) => {
    setOntologyLoading(true);
    setOntologyError(null);
    setOntologyGraph(null);
    setTableSummaries([]);
    setColumnsByTable({});
    setCategories([]);
    setBusinessMetrics([]);
    setSyncJob(null);
    setSchemaPreview(null);
    setSelectedTableName(null);
    setExpandedTables(new Set());
    try {
      await refreshExplorerData(db);
    } catch (err: any) {
      setOntologyError(err.message || "Unable to load ontology");
    } finally {
      setOntologyLoading(false);
    }
    try {
      const dsRes = await getDatabaseDSGraph(db.id);
      if (dsRes.success && dsRes.data) {
        const nodes = dsRes.data.nodes ?? [];
        setSchemaPreview({
          tables: dsRes.data.stats?.table_count ?? nodes.length,
          columns: nodes.reduce((acc, n) => acc + (n.column_count ?? 0), 0),
        });
      }
    } catch {
      // Non-critical
    }
  }, [refreshExplorerData]);

  const handleGenerateCatalog = async () => {
    if (!selectedDb) return;
    setOntologyError(null);
    try {
      // Doc flow: POST /sync → LLM enrich-schema (bulk draft metadata)
      const res = await syncOntologyDatasource(selectedDb.id);
      if (res.success) {
        setSyncJob({
          status: "running",
          total_tables: schemaPreview?.tables ?? 0,
          completed_tables: 0,
          started_at: new Date().toISOString(),
        });
        toast.message("Ontology sync started");
      } else {
        toast.error(res.error?.message || "Unable to start ontology sync");
      }
    } catch (err: any) {
      toast.error(err.message || "Unable to start ontology sync");
    }
  };

  const handleGenerateTableDescription = async (tableName: string) => {
    if (!selectedDb) return;
    setGeneratingTable(tableName);
    try {
      const res = await generateOntologyTableDescription(selectedDb.id, tableName);
      if (res.success) {
        await refreshExplorerData(selectedDb);
        await loadTableColumns(selectedDb.id, tableName);
        toast.success("Table description generated");
      } else {
        toast.error(res.error?.message || "Failed to generate table description");
      }
    } finally {
      setGeneratingTable(null);
    }
  };

  const handleGenerateColumnDescription = async (tableName: string, columnName: string) => {
    if (!selectedDb) return;
    setGeneratingColumn(`${tableName}:${columnName}`);
    try {
      const res = await generateOntologyColumnDescription(selectedDb.id, tableName, columnName);
      if (res.success) {
        await loadTableColumns(selectedDb.id, tableName);
        toast.success("Column description generated");
      } else {
        toast.error(res.error?.message || "Failed to generate column description");
      }
    } finally {
      setGeneratingColumn(null);
    }
  };

  const handleApproveTable = async (table: OntologyTable) => {
    if (!selectedDb) return;
    const res = await updateOntologyTable(selectedDb.id, table.physical_name, {
      description: table.description || "",
      category: table.category || "Unknown",
      status: "APPROVED",
    });
    if (res.success) {
      await refreshExplorerData(selectedDb);
      toast.success("Table approved");
    } else {
      toast.error(res.error?.message || "Failed to update table");
    }
  };

  const handleRejectTable = async (table: OntologyTable) => {
    if (!selectedDb) return;
    const res = await updateOntologyTable(selectedDb.id, table.physical_name, {
      description: table.description || "",
      category: table.category || "Unknown",
      status: "REJECTED",
    });
    if (res.success) {
      await refreshExplorerData(selectedDb);
      toast.success("Table rejected");
    } else {
      toast.error(res.error?.message || "Failed to update table");
    }
  };

  const handlePendingTable = async (table: OntologyTable) => {
    if (!selectedDb) return;
    const res = await updateOntologyTable(selectedDb.id, table.physical_name, {
      description: table.description || "",
      category: table.category || "Unknown",
      status: "PENDING_REVIEW",
    });
    if (res.success) {
      await refreshExplorerData(selectedDb);
      toast.success("Table status reset to Pending Review");
    } else {
      toast.error(res.error?.message || "Failed to update table");
    }
  };

  const startEditDescription = () => {
    if (!selectedTable) return;
    setDescriptionDraft(selectedTable.description || "");
    setEditingDescription(true);
  };

  const cancelEditDescription = () => {
    setEditingDescription(false);
    setDescriptionDraft("");
  };

  const saveEditDescription = async () => {
    if (!selectedDb || !selectedTable) return;
    setSavingDescription(true);
    try {
      const res = await updateOntologyTable(selectedDb.id, selectedTable.physical_name, {
        description: descriptionDraft.trim(),
        category: selectedTable.category || "Unknown",
        status: selectedTable.status || "PENDING",
      });
      if (res.success) {
        await refreshExplorerData(selectedDb);
        setEditingDescription(false);
        toast.success("Description updated");
      } else {
        toast.error(res.error?.message || "Failed to update description");
      }
    } finally {
      setSavingDescription(false);
    }
  };

  const handleApproveColumn = async (tableName: string, col: OntologyColumn) => {
    if (!selectedDb) return;
    const res = await updateOntologyColumn(selectedDb.id, tableName, col.physical_name, {
      business_definition: col.business_definition || "",
      semantic_type: col.semantic_type || "Unknown",
      status: "APPROVED",
    });
    if (res.success) {
      await loadTableColumns(selectedDb.id, tableName);
      toast.success("Column approved");
    } else {
      toast.error(res.error?.message || "Failed to update column");
    }
  };

  const toggleTableExpanded = async (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) next.delete(tableName);
      else next.add(tableName);
      return next;
    });
    if (selectedDb && !columnsByTable[tableName]) {
      await loadTableColumns(selectedDb.id, tableName);
    }
  };

  // ─── Poll sync status while running (doc: every ~5s) ───────────────────────
  useEffect(() => {
    if (!selectedDb || syncJob?.status !== "running") return;
    const connectionId = selectedDb.id;
    const interval = setInterval(async () => {
      try {
        const syncRes = await getOntologySyncStatus(connectionId);
        if (!syncRes.success || !syncRes.data) return;
        setSyncJob(syncRes.data);
        if (syncRes.data.status === "completed") {
          await refreshExplorerData({ id: connectionId, name: selectedDb.name, type: selectedDb.type });
          toast.success("Ontology sync completed");
        } else if (syncRes.data.status === "error") {
          toast.error(syncRes.data.error || "Ontology sync failed");
        } else {
          await getOntologyTables(connectionId).then((res) => {
            if (res.success && res.data) setTableSummaries(res.data.tables);
          });
        }
      } catch {
        // retry next tick
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedDb, syncJob?.status, refreshExplorerData]);

  useEffect(() => {
    if (selectedDb) {
      if (projectId) {
        localStorage.setItem(`vizai_ontology_db_${projectId}`, selectedDb.id);
        sessionStorage.setItem(`vizai_ontology_session_db_${projectId}`, selectedDb.id);
      }
      loadOntology(selectedDb);
    }
  }, [selectedDb, loadOntology, projectId]);

  // Reset description editor when switching tables
  useEffect(() => {
    setEditingDescription(false);
    setDescriptionDraft("");
    setSavingDescription(false);
  }, [selectedTableName]);

  useEffect(() => {
    if (selectedDb && selectedTableName && !columnsByTable[selectedTableName]) {
      loadTableColumns(selectedDb.id, selectedTableName);
    }
  }, [selectedDb, selectedTableName, columnsByTable, loadTableColumns]);

  // ─── Datasource selection handlers ──────────────────────────────────────────
  const openWelcome = () => {
    setPendingDbId(selectedDb?.id ?? pendingDbId);
    setShowWelcome(true);
  };

  const handleWelcomeContinue = () => {
    const db = databases.find((d) => d.id === pendingDbId);
    if (!db) return;
    setShowWelcome(false);
    // Re-selecting the same datasource still refreshes it.
    if (selectedDb?.id === db.id) loadOntology(db);
    else setSelectedDb(db);
  };

  const handleWelcomeCancel = () => {
    setShowWelcome(false);
  };

  const handleDatasourceChange = (id: string) => {
    const db = databases.find((d) => d.id === id);
    if (!db || db.id === selectedDb?.id) return;
    setSelectedDb(db);
  };

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
      setOntologyGraph(res.data);
      await refreshExplorerData(selectedDb);
      setEnrichChatOpen(false);
      setActiveView("business_context");
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
      await refreshExplorerData(selectedDb);
    } catch (err: any) { toast.error(err.message || "Failed to import .pbit file"); }
    finally { setIsPbitUploading(false); }
  };

  const toggleExpanded = toggleTableExpanded;
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
    <div className="flex flex-col h-full w-full max-w-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground">

      {/* ── Hidden PBIT file input ── */}
      <input type="file" accept=".pbit" hidden ref={fileInputRef} onChange={handlePbitFileChange} />

      {/* ══════════════ HEADER BAR ══════════════ */}
      <header className="shrink-0 flex items-center gap-5 px-6 py-3 border-b border-border bg-card/70 backdrop-blur">
        {/* Title */}
        <div className="min-w-0 pl-1">
          <h1 className="text-[13px] font-semibold text-foreground leading-snug tracking-tight">Catalog Explorer</h1>
          <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">
            AI-powered semantic catalog for{" "}
            <span className="text-foreground/70">{selectedDb?.name ?? "—"}</span>
          </p>
        </div>

        {/* View switch tabs */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/20 p-0.5 shrink-0 ml-2">
          {([
            { id: "catalog" as const, label: "Catalog Explorer", Icon: BookOpen },
            { id: "business_context" as const, label: "Business Context", Icon: Briefcase },
          ]).map((t) => {
            const isActive = activeView === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveView(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                }`}
              >
                <t.Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Datasource selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] text-muted-foreground hidden xl:inline">Datasource</span>
          <Select value={selectedDb?.id ?? ""} onValueChange={handleDatasourceChange}>
            <SelectTrigger className="h-7 min-w-[190px] text-[11px] gap-1.5">
              <SelectValue placeholder="Select datasource" />
            </SelectTrigger>
            <SelectContent>
              {databases.map((db) => (
                <SelectItem key={db.id} value={db.id}>
                  <span className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-primary/70 shrink-0" />
                    <span className="font-medium">{db.name}</span>
                    <span className="text-muted-foreground text-[11px]">{dbTypeLabel(db.type)}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(db.status)}`} title={statusText(db.status)} />
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={openWelcome} className="h-7 gap-1 text-[11px] px-2" title="Change datasource">
            <RefreshCw className="w-3 h-3" />
            <span className="hidden 2xl:inline">Change</span>
          </Button>
        </div>

        {/* Actions — Upload + Start Enriching share height / width / radius */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Gradient border matches Start Enriching (primary → accent) */}
          <div
            className={isPbitUploading ? "pbit-glow-btn" : undefined}
            style={{
              display: "inline-flex",
              isolation: "isolate",
              padding: 1,
              borderRadius: 9999,
              background: "linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)",
              height: 36,
              width: 172,
              minWidth: 172,
              maxWidth: 172,
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={handlePbitUploadClick}
              disabled={isPbitUploading || ontologyLoading || !hasCatalog}
              className="gap-1.5 text-[11px] px-3 border-0 shadow-none justify-center"
              style={
                isPbitUploading
                  ? { background: "linear-gradient(135deg,rgba(129,140,248,.15),rgba(34,211,238,.1))", color: "#a5b4fc", pointerEvents: "none", height: "100%", width: "100%", borderRadius: 9999 }
                  : { background: "var(--background)", color: "inherit", height: "100%", width: "100%", borderRadius: 9999 }
              }
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isPbitUploading ? "Importing…" : "Upload .PBIT File"}</span>
            </Button>
          </div>
          {/* Temporarily hidden — Download RDF/OWL
          <Button variant="outline" size="sm" onClick={handleDownloadTTL}
            disabled={ontologyLoading || !hasCatalog} className="h-7 gap-1.5 text-[11px] px-2.5">
            <Download className="w-3 h-3" />
            Download RDF/OWL
          </Button>
          */}
          {/* Primary CTA: generate catalog when missing; enrich via chat when catalog exists */}
          <GradientButton
            onClick={hasCatalog ? handleStartEnriching : handleGenerateCatalog}
            disabled={
              syncJob?.status === "running" ||
              ontologyLoading ||
              !selectedDb ||
              isPbitUploading ||
              (hasCatalog && isEnriching)
            }
            className="rounded-full shadow-none justify-center text-white"
            style={{
              backgroundImage: "linear-gradient(90deg, #6366F1 0%, #0E9AB8 100%)",
              height: 36,
              width: 172,
              minWidth: 172,
              maxWidth: 172,
              paddingLeft: 12,
              paddingRight: 12,
              boxSizing: "border-box",
              flexShrink: 0,
            }}
          >
            <span className="flex items-center justify-center gap-1.5 text-[11px] w-full">
              {syncJob?.status === "running" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span className="truncate">Generating… ({syncJob.completed_tables}/{syncJob.total_tables})</span>
                </>
              ) : hasCatalog ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{isEnriching ? "Preparing…" : "Start Enriching"}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Generate AI Catalog</span>
                </>
              )}
            </span>
          </GradientButton>
        </div>
      </header>

      {/* ── No datasource chosen (behind the welcome dialog) ── */}
      {!selectedDb && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center">
            <Database className="w-6 h-6 opacity-50" />
          </div>
          <p className="text-sm font-medium text-foreground">Choose a datasource to begin</p>
          <p className="text-xs opacity-70 max-w-sm text-center">
            Select an existing database connection to explore and enrich its business ontology.
          </p>
          <Button variant="outline" size="sm" onClick={openWelcome}>Choose Datasource</Button>
        </div>
      )}

      {/* ══════════════ CATALOG EXPLORER BODY (FIXED THREE-COLUMN GRID) ══════════════
          CSS Grid (not flex) so column tracks cannot grow/shrink from content.
          Selecting a table ONLY updates selectedTableName — never remounts or
          swaps these three panes. */}
      {activeView === "catalog" && selectedDb && (
      <div
        className="flex-1 min-h-0 min-w-0 overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: "212px minmax(0, 1fr) 400px", gridTemplateRows: "minmax(0, 1fr)" }}
      >

        {/* ──────────── LEFT SIDEBAR ──────────── */}
        <aside className="min-w-0 overflow-hidden flex flex-col border-r border-border bg-card/50">
          <div className="flex-1 min-h-0 overflow-y-auto py-3">

            {/* Section label */}
            <div className="flex items-center gap-1.5 px-3 mb-2">
              <p className="text-[9.5px] font-semibold text-primary uppercase tracking-[0.14em]">Filters</p>
            </div>

            {/* Status filter list */}
            <div className="px-3 space-y-px">
              {STATUS_FILTERS.map((f) => {
                const count = countFor(f.id);
                const isActive = statusFilter === f.id && categoryFilter === "all";
                return (
                  <button
                    key={f.id}
                    onClick={() => { setStatusFilter(f.id); setCategoryFilter("all"); }}
                    className={`group w-full flex items-center gap-2.5 px-2.5 py-1 rounded-lg text-left transition-all duration-150 ${
                      isActive
                        ? "bg-primary/15 text-foreground font-medium ring-1 ring-inset ring-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <f.Icon className={`w-3.5 h-3.5 shrink-0 transition-opacity ${f.color} ${isActive ? "opacity-100" : "opacity-50 group-hover:opacity-90"}`} />
                    <span className="flex-1 text-[12.5px] truncate">{f.label}</span>
                    <span className={`text-[10.5px] tabular-nums shrink-0 min-w-[22px] text-right ${isActive ? "text-primary font-semibold" : "text-muted-foreground/50"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Filter by Category (AI generated) */}
            {aiCategories.length > 0 && (
              <div className="mt-4 px-2">
                <div className="-mx-2 mb-4 border-t border-border/50" />
                <div className="px-1 mb-2">
                  <p className="text-[9.5px] font-semibold text-primary uppercase tracking-[0.08em] whitespace-nowrap">
                    Filter by Category
                  </p>
                </div>
                <div className="px-1 space-y-px max-h-[30vh] overflow-y-auto">
                  {aiCategories.map((cat) => {
                    const isActive = categoryFilter === cat;
                    const cnt = ontologyTables.filter((t) => resolveCategory(t) === cat).length;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setStatusFilter("all"); }}
                        className={`group w-full flex items-center gap-2.5 px-2.5 py-1 rounded-lg text-left transition-all duration-150 ${
                          isActive
                            ? "bg-primary/15 text-foreground font-medium ring-1 ring-inset ring-primary/30"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                        }`}
                      >
                        <Tag className={`w-3.5 h-3.5 shrink-0 transition-opacity ${isActive ? "text-primary opacity-100" : "text-violet-400/70 opacity-70 group-hover:opacity-100"}`} />
                        <span className="flex-1 text-[12.5px] truncate">{cat}</span>
                        <span className={`text-[10.5px] tabular-nums shrink-0 min-w-[22px] text-right ${isActive ? "text-primary font-semibold" : "text-muted-foreground/50"}`}>{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ──────────── CENTER PANEL (table list) ──────────── */}
        <main className="min-w-0 overflow-hidden flex flex-col border-r border-border">

          {/* ── Compact KPI status bar + attached summary ── */}
          <div className="shrink-0 border-b border-border bg-card/10 min-w-0">
            <div className="overflow-x-auto">
              <div className="flex items-center px-4 py-3 w-max min-w-full">
                {[
                  {
                    label: "Tables",
                    sub: "Total",
                    value: stats.tables,
                    Icon: Database,
                    color: "#8B5CF6",
                  },
                  {
                    label: "Columns",
                    sub: "Total",
                    value: hasCatalog ? stats.columns : (schemaPreview?.columns ?? stats.columns),
                    Icon: Columns3,
                    color: "#3B82F6",
                  },
                  {
                    label: "Pending Review",
                    sub: "AI Generated",
                    value: stats.pending,
                    Icon: Clock,
                    color: "#F59E0B",
                  },
                  {
                    label: "Approved",
                    sub: "Human Verified",
                    value: stats.approved,
                    Icon: CheckCircle2,
                    color: "#22C55E",
                  },
                  {
                    label: "Rejected",
                    sub: "Needs Attention",
                    value: stats.rejected,
                    Icon: XCircle,
                    color: "#EF4444",
                  },
                  {
                    label: "Business Metrics",
                    sub: "Defined",
                    value: metricEntries.length,
                    Icon: TrendingUp,
                    color: "#06B6D4",
                  },
                ].map((s, i, arr) => (
                  <Fragment key={s.label}>
                    <div className="group/tile flex items-center gap-3 shrink-0 rounded-lg px-1.5 py-1 transition-colors duration-[180ms] ease-out hover:bg-white/[0.035]">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-[filter] duration-[180ms] ease-out group-hover/tile:brightness-125"
                        style={{
                          backgroundColor: `${s.color}1F`,
                          border: `1px solid ${s.color}40`,
                        }}
                      >
                        <s.Icon className="w-[18px] h-[18px]" strokeWidth={1.75} style={{ color: s.color }} />
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="text-[24px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                          {ontologyLoading
                            ? <span className="inline-block w-7 h-5 rounded bg-muted/40 animate-pulse align-middle" />
                            : s.value.toLocaleString()}
                        </span>
                        <div className="flex flex-col justify-center gap-0.5 shrink-0">
                          <span className="text-[14px] font-semibold leading-none text-foreground whitespace-nowrap">
                            {s.label}
                          </span>
                          <span
                            className="text-[11px] font-medium whitespace-nowrap leading-[1.2]"
                            style={{ color: "rgba(255,255,255,0.55)" }}
                          >
                            {s.sub}
                          </span>
                        </div>
                      </div>
                    </div>

                    {i < arr.length - 1 && (
                      <div
                        aria-hidden
                        className="h-9 w-px shrink-0 self-center"
                        style={{
                          backgroundColor: "rgba(255,255,255,0.14)",
                          marginLeft: 14,
                          marginRight: 14,
                        }}
                      />
                    )}
                  </Fragment>
                ))}
              </div>
            </div>

            {/* AI Catalog summary — centered, branded gradient + colored metrics */}
            {syncJob?.status !== "running" && hasCatalog ? (
              <div className="flex items-center justify-start gap-3 min-h-11 px-4 py-2.5 border-t border-white/[0.05] text-[11px] font-normal overflow-x-auto whitespace-nowrap"
                style={{ background: "linear-gradient(90deg, rgba(91,103,241,0.07) 0%, transparent 35%, transparent 65%, rgba(6,182,212,0.06) 100%)" }}
              >
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className="w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 bg-gradient-to-r from-primary to-accent shadow-sm">
                    <Wand2 className="w-3 h-3 text-white" strokeWidth={1.75} />
                  </span>
                  <span className="font-normal tracking-wide text-foreground/80">
                    {syncJob?.status === "error" ? "AI Catalog Partial" : "AI Catalog Generated"}
                  </span>
                </span>

                <span aria-hidden className="h-3 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />

                <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span className="font-normal" style={{ color: "#7DD3FC" }}>{stats.tables}</span>
                  <span style={{ color: "rgba(255,255,255,0.42)" }}>Tables</span>
                </span>
                <span aria-hidden className="h-3 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />
                <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span className="font-normal" style={{ color: "#A5B4FC" }}>{stats.columns}</span>
                  <span style={{ color: "rgba(255,255,255,0.42)" }}>Columns</span>
                </span>
                <span aria-hidden className="h-3 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />
                <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
                  <span className="font-normal" style={{ color: "#F0ABFC" }}>{catalogTotalRelationships}</span>
                  <span style={{ color: "rgba(255,255,255,0.42)" }}>Relationships</span>
                </span>
                {catalogAvgConfidencePct !== null && (
                  <>
                    <span aria-hidden className="h-3 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />
                    <span className="flex items-center gap-1.5 shrink-0 tabular-nums">
                      <span
                        className="font-normal"
                        style={{
                          color:
                            catalogAvgConfidencePct >= 90
                              ? "#6EE7B7"
                              : catalogAvgConfidencePct >= 70
                                ? "#FCD34D"
                                : "#FCA5A5",
                        }}
                      >
                        {catalogAvgConfidencePct}%
                      </span>
                      <span style={{ color: "rgba(255,255,255,0.42)" }}>Confidence</span>
                    </span>
                  </>
                )}
                {catalogGeneratedAt && (
                  <>
                    <span aria-hidden className="h-3 w-px shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.14)" }} />
                    <span className="flex items-center gap-1 shrink-0 font-normal" style={{ color: "#FBBF24" }}>
                      <Clock3 className="w-3 h-3" strokeWidth={1.75} style={{ color: "#F59E0B" }} />
                      {relativeTime(catalogGeneratedAt)}
                    </span>
                  </>
                )}

                <div className="flex-1 min-w-2" />

                <button
                  type="button"
                  onClick={handleGenerateCatalog}
                  disabled={syncJob?.status === "running" || ontologyLoading || !selectedDb || isPbitUploading}
                  title="Regenerate AI Catalog for this datasource"
                  className="group/regen shrink-0 inline-flex items-center gap-1.5 rounded-full text-[10.5px] font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none hover:brightness-110 hover:shadow-[0_0_12px_-2px_rgba(99,102,241,0.55)] active:scale-[0.98]"
                  style={{
                    backgroundImage: "linear-gradient(90deg, #6366F1 0%, #0E9AB8 100%)",
                    padding: 8,
                  }}
                >
                  <RefreshCw className="w-3 h-3 shrink-0 transition-transform duration-300 group-hover/regen:rotate-180" strokeWidth={2.25} />
                  Regenerate
                </button>
              </div>
            ) : null}
          </div>

          {/* ── Center sub-toolbar: search + sort ── */}
          {!ontologyLoading && !ontologyError && syncJob?.status !== "running" && hasCatalog && (
            <div className="shrink-0 flex items-center gap-3 px-3 py-2 border-b border-border bg-card/15">
              <div className="relative flex-1 max-w-sm group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70 group-focus-within:text-primary transition-colors pointer-events-none" />
                <input
                  className="w-full h-8 pl-9 pr-8 text-[12px] rounded-lg border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/60 transition-colors focus:outline-none focus:bg-background focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  placeholder="Search tables..."
                  value={sidebarSearch}
                  onChange={(e) => setSidebarSearch(e.target.value)}
                />
                {sidebarSearch && (
                  <button
                    type="button"
                    onClick={() => setSidebarSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] text-muted-foreground shrink-0">Sort by</span>
                <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as any)}>
                  <SelectTrigger className="h-8 min-w-[160px] text-[12px] gap-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recently_updated">Recently Updated</SelectItem>
                    <SelectItem value="name_az">Name (A–Z)</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Main content area ── */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-4">

            {ontologyLoading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}

            {ontologyError && !ontologyLoading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-destructive">
                <XCircle className="w-7 h-7" />
                <p className="text-sm">{ontologyError}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => selectedDb && loadOntology(selectedDb)}>Retry</Button>
                  <Button variant="outline" size="sm" onClick={openWelcome}>Change Datasource</Button>
                </div>
              </div>
            )}

            {/* Generation in progress — table list stays hidden the whole run so we
                never show a wall of half-empty "Not yet analyzed" cards; instead a
                single progress panel takes over until every table is done. */}
            {!ontologyLoading && !ontologyError && syncJob?.status === "running" && (
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center max-w-md mx-auto">
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-semibold text-foreground">Generating your AI Catalog…</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    {"Analyzing your schema and enriching every table…"}
                  </p>
                </div>
                <div className="w-full space-y-1.5">
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(100, Math.round((syncJob.completed_tables / Math.max(syncJob.total_tables, 1)) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[10.5px] text-muted-foreground/70 tabular-nums">
                    {syncJob.completed_tables} / {syncJob.total_tables} tables enriched
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground/50">
                  This runs in the background — the table list will appear automatically once it's done.
                </p>
              </div>
            )}

            {/* No AI Catalog generated yet for this datasource — single onboarding CTA */}
            {!ontologyLoading && !ontologyError && !hasCatalog && syncJob?.status !== "running" && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-lg animate-pulse-glow">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[15px] font-semibold text-foreground">AI Catalog</p>
                  <p className="text-[12px] text-muted-foreground leading-relaxed">
                    Generate AI descriptions, relationships, business concepts, categories and semantic
                    metadata for every table.
                  </p>
                </div>
                {schemaEstimate && (
                  <div className="w-full rounded-xl border border-white/[0.10] bg-gradient-to-b from-white/[0.04] to-transparent px-4 py-4">
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      <Clock3 className="w-3 h-3 text-muted-foreground/70" strokeWidth={2} />
                      <p className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-[0.08em]">
                        Estimated time
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2.5 text-center">
                        <p className="text-[15px] font-semibold text-foreground tabular-nums leading-none">
                          {schemaEstimate.tables}
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground/70 leading-none">Tables</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.07] bg-black/20 px-2.5 py-2.5 text-center">
                        <p className="text-[15px] font-semibold text-foreground tabular-nums leading-none">
                          {schemaEstimate.columns}
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground/70 leading-none">Columns</p>
                      </div>
                      <div className="rounded-lg border border-primary/25 bg-primary/[0.08] px-2.5 py-2.5 text-center">
                        <p className="text-[15px] font-semibold text-primary tabular-nums leading-none">
                          ~{schemaEstimate.seconds}s
                        </p>
                        <p className="mt-1.5 text-[10px] text-muted-foreground/70 leading-none">Duration</p>
                      </div>
                    </div>
                  </div>
                )}
                <GradientButton
                  onClick={handleGenerateCatalog}
                  disabled={ontologyLoading || !selectedDb}
                  className="rounded-full shadow-none justify-center text-white"
                  style={{
                    backgroundImage: "linear-gradient(90deg, #6366F1 0%, #0E9AB8 100%)",
                    height: 36,
                    minWidth: 172,
                    paddingLeft: 16,
                    paddingRight: 16,
                  }}
                >
                  <span className="flex items-center justify-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Generate AI Catalog
                  </span>
                </GradientButton>
              </div>
            )}

            {!ontologyLoading && !ontologyError && syncJob?.status !== "running" && filteredTables.length === 0 && hasCatalog && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                <BookOpen className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">No tables match your filters.</p>
                <p className="text-xs opacity-70">Try clearing the search or changing the filter.</p>
              </div>
            )}

            {!ontologyLoading && !ontologyError && syncJob?.status !== "running" && hasCatalog && filteredTables.map((table) => {
              const isExpanded = expandedTables.has(table.physical_name);
              const isSelected = selectedTableName === table.physical_name;
              const isFav = favorites.has(table.physical_name);
              const colCount = table.columns?.length || table.column_count || 0;
              const relCount = relCountByTable[table.physical_name] ?? 0;
              const timeAgo = relativeTime(table.last_updated);
              const confPct = toConfidencePct(table.ai_confidence);
              const tags = (table.tags && table.tags.length > 0)
                ? table.tags
                : (table.category ? [table.category] : []);

              return (
                <div
                  key={table.physical_name}
                  className={`group/card rounded-2xl border cursor-pointer overflow-hidden transition-[border-color,box-shadow,background-color,transform] duration-200 ease-out ${
                    isSelected
                      ? "border-primary/50 bg-gradient-to-br from-primary/[0.08] via-card/80 to-card/80 shadow-[0_0_0_1px_rgba(129,140,248,0.15)]"
                      : "border-white/[0.08] bg-gradient-to-br from-white/[0.035] via-card/75 to-card/60 hover:border-primary/40 hover:shadow-[0_10px_28px_-14px_rgba(0,0,0,0.65)] hover:-translate-y-0.5"
                  }`}
                  onClick={() => { setSelectedTableName(table.physical_name); setRightPanelTab("overview"); }}
                >
                  {/* ── Card header: top row = title/badges + meta; description uses full width under meta ── */}
                  <div className="flex items-start gap-4 p-5">
                    {/* Left icon — unified primary tint */}
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: "rgba(129,140,248,0.12)",
                        border: "1px solid rgba(129,140,248,0.25)",
                      }}
                    >
                      <Table2 className="w-5 h-5 text-primary" strokeWidth={1.75} />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Top row: title/badges | Columns/Relationships + expand */}
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="text-[15px] font-semibold text-foreground tracking-tight truncate">
                              {table.physical_name}
                            </h3>
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(table.physical_name); }}
                              className="p-0.5 rounded text-muted-foreground/35 hover:text-yellow-400 transition-colors duration-150 shrink-0"
                              title="Toggle favorite"
                            >
                              <Star className={`w-3.5 h-3.5 ${isFav ? "text-yellow-400 fill-yellow-400" : ""}`} />
                            </button>
                          </div>

                          <div className="flex items-center flex-wrap gap-2 mt-2.5">
                            <StatusBadge status={table.status} />
                            {(table.is_ai_generated) && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full font-medium leading-none border"
                                style={{ backgroundColor: "rgba(139,92,246,0.22)", color: "#C4B5FD", borderColor: "rgba(167,139,250,0.55)", padding: "5px 12px", height: 26, fontSize: 13 }}
                              >
                                <Sparkles className="w-3 h-3" strokeWidth={2} style={{ color: "#C4B5FD" }} />
                                AI Generated
                              </span>
                            )}
                            {confPct !== null && (
                              <span className="inline-flex items-center gap-1.5 font-medium tabular-nums" style={{ color: "#93C5FD", fontSize: 13 }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: confidenceBarHex(confPct) }} />
                                {confPct}%
                                <span className="font-normal" style={{ color: "rgba(147,197,253,0.75)" }}>Confidence</span>
                              </span>
                            )}
                            {timeAgo && (
                              <span className="font-normal" style={{ color: "rgba(255,255,255,0.42)", fontSize: 13 }}>
                                Updated {timeAgo}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right metadata + expand (stays top-right) */}
                        <div className="shrink-0 flex items-center gap-2.5 self-start pt-0.5">
                          <span
                            className="inline-flex items-center gap-1.5 h-8 rounded-lg tabular-nums"
                            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "0 12px", fontSize: 13, color: "rgba(255,255,255,0.75)" }}
                          >
                            <Columns3 className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                            {colCount} Columns
                          </span>
                          <span className="text-white/15 select-none" style={{ fontSize: 13 }}>|</span>
                          <span
                            className="inline-flex items-center gap-1.5 h-8 rounded-lg tabular-nums"
                            style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "0 12px", fontSize: 13, color: "rgba(255,255,255,0.75)" }}
                          >
                            <Network className="w-3.5 h-3.5 text-primary" strokeWidth={1.75} />
                            {relCount} Relationships
                          </span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpanded(table.physical_name); }}
                            className={`w-9 h-9 rounded-lg flex items-center justify-center border transition-all duration-200 ease-out shrink-0 ${
                              isExpanded
                                ? "bg-primary/15 border-primary/35 text-primary"
                                : "bg-white/[0.03] border-white/[0.08] text-muted-foreground/60 hover:text-primary hover:border-primary/30 hover:bg-primary/10"
                            }`}
                            title={isExpanded ? "Collapse columns" : "Expand columns"}
                          >
                            <ChevronDown
                              className={`w-[18px] h-[18px] transition-transform duration-200 ease-out ${isExpanded ? "rotate-180" : "rotate-0"}`}
                              strokeWidth={2}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Description — full width under Columns/Relationships */}
                      <p
                        className="mt-3 leading-[1.7] line-clamp-2"
                        style={{
                          fontSize: 15,
                          color: table.description ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.28)",
                          maskImage: table.description ? "linear-gradient(180deg, #000 60%, transparent)" : undefined,
                          WebkitMaskImage: table.description ? "linear-gradient(180deg, #000 60%, transparent)" : undefined,
                        }}
                      >
                        {table.description || "Not generated"}
                      </p>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {tags.map((tag, i) => {
                            const tagPalettes = [
                              { backgroundColor: "rgba(139,92,246,0.14)", color: "#C4B5FD", borderColor: "rgba(167,139,250,0.4)" },
                              { backgroundColor: "rgba(59,130,246,0.14)", color: "#93C5FD", borderColor: "rgba(96,165,250,0.4)" },
                              { backgroundColor: "rgba(16,185,129,0.14)", color: "#6EE7B7", borderColor: "rgba(52,211,153,0.4)" },
                              { backgroundColor: "rgba(249,115,22,0.14)", color: "#FDBA74", borderColor: "rgba(251,146,60,0.4)" },
                              { backgroundColor: "rgba(6,182,212,0.14)", color: "#67E8F9", borderColor: "rgba(34,211,238,0.4)" },
                              { backgroundColor: "rgba(236,72,153,0.14)", color: "#F9A8D4", borderColor: "rgba(244,114,182,0.4)" },
                            ];
                            const tone = tagPalettes[i % tagPalettes.length];
                            return (
                              <span
                                key={tag}
                                className="rounded-full font-medium capitalize transition-opacity duration-150 hover:opacity-90"
                                style={{
                                  backgroundColor: tone.backgroundColor,
                                  border: `1px solid ${tone.borderColor}`,
                                  color: tone.color,
                                  padding: "5px 16px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  lineHeight: 1.4,
                                  fontSize: 13,
                                }}
                              >
                                #{tag}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Expanded table — continuous card, no double border ── */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.06] animate-in fade-in duration-200">
                      {(table.columns ?? []).length > 0 ? (
                        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                          <table className="w-full border-collapse" style={{ fontSize: 14 }}>
                            <thead className="sticky top-0 z-[1]">
                              <tr className="bg-[#0e1018]/95 backdrop-blur-sm border-b border-white/[0.06]">
                                {["Column Name", "AI Description", "Type", "Tag", "Confidence", "Status", "Actions"].map((h) => (
                                  <th
                                    key={h}
                                    className="text-left font-semibold uppercase tracking-[0.1em] px-4 py-3 whitespace-nowrap"
                                    style={{ color: "#FFFFFF", fontSize: 14 }}
                                  >
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(table.columns ?? []).map((col) => {
                                const conf = toConfidencePct(col.confidence);
                                const sem = (col.semantic_type || "").toLowerCase();
                                const isPK = sem === "identifier" || sem === "pk";
                                const isFK = sem === "reference" || sem === "fk";
                                const typeBadge = dataTypeBadge(col.data_type);
                                const tagTone = semanticTypeStyle(col.semantic_type);
                                const barHex = conf !== null ? confidenceBarHex(conf) : null;
                                const confHex = conf !== null ? confidenceTextHex(conf) : null;
                                const keyBadgeBase: React.CSSProperties = {
                                  display: "inline-flex",
                                  alignItems: "center",
                                  borderRadius: 4,
                                  border: "1px solid",
                                  padding: "1px 8px",
                                  fontSize: 14,
                                  fontWeight: 400,
                                  lineHeight: "18px",
                                  height: 22,
                                };

                                return (
                                  <tr
                                    key={col.physical_name}
                                    className="group/row border-b border-white/[0.04] last:border-b-0 cursor-pointer transition-colors duration-150 hover:bg-white/[0.035]"
                                  >
                                    <td className="px-4 py-3.5 align-middle whitespace-nowrap" style={{ fontSize: 14 }}>
                                      <div className="flex items-center gap-2">
                                        {isPK && (
                                          <span
                                            style={{
                                              ...keyBadgeBase,
                                              backgroundColor: "rgba(139,92,246,0.22)",
                                              color: "#C4B5FD",
                                              borderColor: "rgba(167,139,250,0.55)",
                                            }}
                                          >
                                            PK
                                          </span>
                                        )}
                                        {isFK && (
                                          <span
                                            style={{
                                              ...keyBadgeBase,
                                              backgroundColor: "rgba(59,130,246,0.22)",
                                              color: "#93C5FD",
                                              borderColor: "rgba(96,165,250,0.55)",
                                            }}
                                          >
                                            FK
                                          </span>
                                        )}
                                        {!isPK && !isFK && (
                                          <span
                                            style={{
                                              ...keyBadgeBase,
                                              backgroundColor: "rgba(255,255,255,0.05)",
                                              color: "rgba(255,255,255,0.45)",
                                              borderColor: "rgba(255,255,255,0.1)",
                                            }}
                                          >
                                            COL
                                          </span>
                                        )}
                                        <span className="font-mono tracking-tight" style={{ color: "rgba(255,255,255,0.92)", fontSize: 14, fontWeight: 400 }}>
                                          {col.physical_name}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3.5 align-middle max-w-[300px]" style={{ fontSize: 14 }}>
                                      {col.business_definition ? (
                                        <span className="line-clamp-2 leading-[1.6]" style={{ color: "rgba(255,255,255,0.62)", fontSize: 14 }}>
                                          {col.business_definition}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 italic" style={{ color: "rgba(255,255,255,0.35)", fontSize: 14 }}>
                                          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.75} style={{ color: "rgba(196,181,253,0.55)" }} />
                                          This field hasn't been analyzed yet.
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 align-middle whitespace-nowrap" style={{ fontSize: 14 }}>
                                      {typeBadge ? (
                                        <span
                                          className="inline-flex items-center rounded-md font-medium border lowercase"
                                          style={{ backgroundColor: typeBadge.style.backgroundColor, color: typeBadge.style.color, borderColor: typeBadge.style.borderColor, padding: "2px 12px", height: 24, fontSize: 14, fontWeight: 500 }}
                                        >
                                          {typeBadge.label}
                                        </span>
                                      ) : (
                                        <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 14 }}>—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 align-middle" style={{ fontSize: 14 }}>
                                      {col.semantic_type ? (
                                        <span
                                          className="inline-flex items-center rounded-full font-medium border capitalize"
                                          style={{ backgroundColor: tagTone.backgroundColor, color: tagTone.color, borderColor: tagTone.borderColor, padding: "2px 12px", height: 24, fontSize: 14, fontWeight: 500 }}
                                        >
                                          {col.semantic_type}
                                        </span>
                                      ) : (
                                        <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 14 }}>—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 align-middle min-w-[130px]" style={{ fontSize: 14 }}>
                                      {conf !== null && barHex && confHex ? (
                                        <div className="flex items-center gap-2.5">
                                          <div className="flex-1 h-2 rounded-full overflow-hidden min-w-[64px]" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                                            <div
                                              className="h-full rounded-full transition-all duration-300"
                                              style={{
                                                width: `${conf}%`,
                                                backgroundColor: barHex,
                                                boxShadow: `0 0 8px ${barHex}88`,
                                              }}
                                            />
                                          </div>
                                          <span className="tabular-nums font-semibold min-w-[32px]" style={{ color: confHex, fontSize: 14 }}>
                                            {conf}%
                                          </span>
                                        </div>
                                      ) : (
                                        <span style={{ color: "rgba(255,255,255,0.28)", fontSize: 14 }}>—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3.5 align-middle whitespace-nowrap" style={{ fontSize: 14 }}>
                                      <StatusBadge status={col.status} />
                                    </td>
                                    <td className="px-4 py-3.5 align-middle whitespace-nowrap" style={{ fontSize: 14 }}>
                                      <div className="flex items-center gap-1">
                                        <button
                                          className="w-8 h-8 rounded-md flex items-center justify-center transition-colors duration-150"
                                          style={{ color: "rgba(255,255,255,0.35)" }}
                                          title="Regenerate description"
                                          disabled={generatingColumn === `${table.physical_name}:${col.physical_name}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleGenerateColumnDescription(table.physical_name, col.physical_name);
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                                        >
                                          {generatingColumn === `${table.physical_name}:${col.physical_name}`
                                            ? <Loader2 className="w-4 h-4 animate-spin" />
                                            : <Wand2 className="w-4 h-4" />}
                                        </button>
                                        <button
                                          className="w-8 h-8 rounded-md flex items-center justify-center transition-colors duration-150"
                                          style={{ color: "rgba(255,255,255,0.35)" }}
                                          title="Approve column"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApproveColumn(table.physical_name, col);
                                          }}
                                          onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.9)"; e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.backgroundColor = "transparent"; }}
                                        >
                                          <CheckCircle2 className="w-4 h-4" />
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
                        <p className="px-5 py-6 text-center" style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>No column data available.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* ──────────── RIGHT DETAILS PANEL (always mounted, always 400px) ──────────── */}
        <aside className="min-w-0 overflow-hidden flex flex-col bg-card/40 border-l border-border">
          {selectedTable ? (
            <div key={selectedTable.physical_name} className="flex flex-col h-full min-h-0 animate-in fade-in duration-200">

              {/* Entity header */}
              <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 bg-gradient-to-b from-primary/[0.05] to-transparent">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-sm">
                      <Table2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-foreground truncate leading-tight">{selectedTable.physical_name}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em] mt-1">Entity · Table</p>
                    </div>
                  </div>
                  <button onClick={() => toggleFavorite(selectedTable.physical_name)} className="p-1.5 rounded-md hover:bg-muted/40 transition-colors shrink-0" title="Toggle favorite">
                    <Star className={`w-4 h-4 transition-colors ${favorites.has(selectedTable.physical_name) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30 hover:text-yellow-400"}`} />
                  </button>
                </div>
                {/* Badges */}
                <div className="flex items-center flex-wrap gap-1.5 mt-3">
                  <StatusBadge status={selectedTable.status} />
                  {selectedTable.is_ai_generated && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full font-medium leading-none border"
                      style={{ backgroundColor: "rgba(139,92,246,0.22)", color: "#C4B5FD", borderColor: "rgba(167,139,250,0.55)", padding: "5px 12px", height: 26, fontSize: 13 }}
                    >
                      <Sparkles className="w-3 h-3" strokeWidth={2} style={{ color: "#C4B5FD" }} />
                      AI Generated
                    </span>
                  )}
                  {selectedTable.category && (
                    <span
                      className="inline-flex items-center rounded-full font-medium leading-none border"
                      style={{ backgroundColor: "rgba(148,163,184,0.14)", color: "#CBD5E1", borderColor: "rgba(148,163,184,0.35)", padding: "5px 12px", height: 26, fontSize: 13 }}
                    >
                      {selectedTable.category}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border shrink-0 bg-card/30 px-1 pt-1 overflow-x-auto">
                {[
                  { id: "overview" as const, label: "Overview" },
                  { id: "columns" as const, label: `Columns (${selectedTable.columns?.length || selectedTable.column_count || 0})` },
                  { id: "relationships" as const, label: `Relationships (${relCount})` },
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
                  <div key={selectedTable.physical_name} className="p-4 space-y-4 animate-in fade-in duration-200">

                    {isSelectedTableGenerating && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/20 bg-primary/[0.06] text-[11px] text-foreground/80">
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                        {selectedTable.status === "GENERATING"
                          ? "Generating AI content for this table…"
                          : "Queued — this table will be enriched shortly…"}
                      </div>
                    )}

                    {/* AI Generated Description */}
                    <PanelSection
                      icon={<FileText className="w-3.5 h-3.5" />}
                      iconColor="text-white"
                      title="AI Generated Description"
                      action={
                        editingDescription ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={cancelEditDescription}
                              disabled={savingDescription}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={saveEditDescription}
                              disabled={savingDescription}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                              title="Save"
                            >
                              {savingDescription ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={startEditDescription}
                              className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                              title="Edit description"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {(selectedTable.status || "").toUpperCase() !== "APPROVED" && (
                              <button
                                type="button"
                                onClick={() => handleApproveTable(selectedTable)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                title="Approve Table"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {(selectedTable.status || "").toUpperCase() !== "REJECTED" && (
                              <button
                                type="button"
                                onClick={() => handleRejectTable(selectedTable)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Reject Table"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {((selectedTable.status || "").toUpperCase() === "APPROVED" || (selectedTable.status || "").toUpperCase() === "REJECTED") && (
                              <button
                                type="button"
                                onClick={() => handlePendingTable(selectedTable)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-amber-400 hover:bg-amber-500/10 transition-colors"
                                title="Reset to Pending Review"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )
                      }
                    >
                      {editingDescription ? (
                        <textarea
                          value={descriptionDraft}
                          onChange={(e) => setDescriptionDraft(e.target.value)}
                          rows={4}
                          autoFocus
                          disabled={savingDescription}
                          className="w-full resize-y min-h-[88px] rounded-lg bg-black/30 px-3 py-2 text-[12px] text-foreground/85 leading-relaxed outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-60"
                          style={{ border: "1px solid rgba(255,255,255,0.18)" }}
                          placeholder="Enter a business description for this table…"
                        />
                      ) : selectedTable.description ? (
                        <p className="text-[12px] text-foreground/70 leading-relaxed">{selectedTable.description}</p>
                      ) : (
                        <EmptyHint
                          text={isSelectedTableGenerating ? "Analyzing this table…" : "Not generated"}
                          sub={isSelectedTableGenerating ? "AI enrichment in progress." : "Run Generate / Regenerate to create draft metadata."}
                        />
                      )}
                    </PanelSection>

                    {/* Business Purpose */}
                    <PanelSection icon={<Briefcase className="w-3.5 h-3.5" />} iconColor="text-sky-400/80" title="Business Purpose">
                      {selectedTable.business_purpose ? (
                        <p className="text-[12px] text-foreground/70 leading-relaxed">{selectedTable.business_purpose}</p>
                      ) : (
                        <EmptyHint
                          text={isSelectedTableGenerating ? "Analyzing this table…" : "Not generated"}
                          sub={isSelectedTableGenerating ? "AI enrichment in progress." : "Run Generate / Regenerate to create it."}
                        />
                      )}
                    </PanelSection>

                    {/* Business Concepts */}
                    <PanelSection icon={<Brain className="w-3.5 h-3.5" />} iconColor="text-violet-400/80" title="Business Concepts">
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
                              <Badge key={concept} variant="outline" className={`text-[10px] px-3 py-0.5 rounded-md transition-transform hover:-translate-y-0.5 ${colors[i % colors.length]}`}>
                                {concept}
                              </Badge>
                            );
                          })}
                        </div>
                      ) : (
                        <EmptyHint text="Not generated" sub="Run Generate / Regenerate to enrich this entity." />
                      )}
                    </PanelSection>

                    {/* Common Business Questions */}
                    <PanelSection icon={<ListChecks className="w-3.5 h-3.5" />} iconColor="text-emerald-400/80" title="Common Business Questions">
                      {selectedTable.common_questions && selectedTable.common_questions.length > 0 ? (
                        <ul className="space-y-1.5">
                          {selectedTable.common_questions.map((q) => (
                            <li key={q} className="flex items-start gap-2 text-[11px] text-foreground/70 leading-relaxed">
                              <span className="shrink-0 mt-1.5 text-primary/60">•</span>
                              {q}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyHint text="Not generated" sub="Run Generate / Regenerate to enrich this entity." />
                      )}
                    </PanelSection>

                    {/* AI Confidence */}
                    {(() => {
                      const confPct = toConfidencePct(selectedTable.ai_confidence);
                      return (
                        <PanelSection icon={<ShieldCheck className="w-3.5 h-3.5" />} iconColor="text-emerald-400/80" title="AI Confidence">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-muted-foreground/70">Overall confidence score</span>
                            {confPct !== null ? (
                              <span className="text-[15px] font-bold tabular-nums leading-none" style={{ color: confidenceTextHex(confPct) }}>{confPct}%</span>
                            ) : (
                              <span className="text-[10px] text-muted-foreground/40 italic">Not generated</span>
                            )}
                          </div>
                          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                            {confPct !== null ? (
                              <div
                                className="h-full rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${confPct}%`, backgroundColor: confidenceBarHex(confPct), boxShadow: `0 0 8px ${confidenceBarHex(confPct)}88` }}
                              />
                            ) : (
                              <div className="h-full rounded-full bg-muted/20" />
                            )}
                          </div>
                          {confPct === null && (
                            <p className="text-[9px] text-muted-foreground/35 italic mt-1.5">Confidence calculated after enrichment.</p>
                          )}
                        </PanelSection>
                      );
                    })()}

                    {/* Metadata */}
                    <PanelSection icon={<Info className="w-3.5 h-3.5" />} iconColor="text-sky-400/80" title="Metadata">
                      <div className="grid grid-cols-2 gap-2">
                        <MetaCard icon={<Building2 className="w-2.5 h-2.5" />} iconColor="text-sky-400/70" label="Domain">
                          {selectedTable.category ? selectedTable.category : <span className="text-muted-foreground/40 font-normal">—</span>}
                        </MetaCard>
                        <MetaCard icon={<User className="w-2.5 h-2.5" />} iconColor="text-violet-400/70" label="Owner">
                          {selectedTable.owner ? selectedTable.owner : <span className="text-muted-foreground/40 font-normal">—</span>}
                        </MetaCard>
                        <MetaCard icon={<ShieldCheck className="w-2.5 h-2.5" />} iconColor="text-emerald-400/70" label="Data Steward">
                          {selectedTable.data_steward
                            ? <span className="text-primary/80">{selectedTable.data_steward}</span>
                            : <span className="text-muted-foreground/40 font-normal">—</span>}
                        </MetaCard>
                        <MetaCard icon={<CalendarDays className="w-2.5 h-2.5" />} iconColor="text-amber-400/70" label="Created">
                          {selectedTable.last_updated
                            ? new Date(selectedTable.last_updated).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : <span className="text-muted-foreground/40 font-normal">—</span>}
                        </MetaCard>
                        <div className="col-span-2">
                          <MetaCard icon={<Clock3 className="w-2.5 h-2.5" />} iconColor="text-sky-400/70" label="Last Updated">
                            {selectedTable.last_updated
                              ? <span>{relativeTime(selectedTable.last_updated)}{selectedTable.updated_by ? ` · ${selectedTable.updated_by}` : ""}</span>
                              : <span className="text-muted-foreground/40 font-normal">—</span>}
                          </MetaCard>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="mt-3">
                        <p className="flex items-center gap-1 text-[9px] font-medium text-muted-foreground/60 uppercase tracking-wide mb-1.5">
                          <Tag className="w-2.5 h-2.5" /> Tags
                        </p>
                        {selectedTable.tags && selectedTable.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTable.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-[10px] rounded-full bg-muted/40 text-muted-foreground border border-border/50 transition-colors hover:bg-muted/60 hover:text-foreground"
                                style={{ padding: "4px 12px", display: "inline-flex", alignItems: "center" }}
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 italic">No tags yet.</span>
                        )}
                      </div>
                    </PanelSection>
                  </div>
                )}

                {/* ── Columns tab ── */}
                {rightPanelTab === "columns" && (
                  <div key={selectedTable.physical_name} className="p-4 animate-in fade-in duration-200">
                    {(selectedTable.columns ?? []).length === 0 ? (
                      <p className="text-[11px] text-muted-foreground text-center py-8">No column data available.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {(selectedTable.columns ?? []).map((col) => {
                          const typeTone = col.semantic_type ? semanticTypeStyle(col.semantic_type) : null;
                          const statusTone = statusStyle(col.status);
                          const statusKey = (col.status || "").toUpperCase();
                          const StatusIcon =
                            statusKey === "APPROVED" || statusKey === "COMPLETED" ? CheckCircle2
                            : statusKey === "REJECTED" ? XCircle
                            : statusKey === "PENDING" || statusKey === "PENDING_REVIEW" || statusKey === "NEEDS_REVIEW" ? Clock
                            : Sparkles;
                          return (
                            <div
                              key={col.physical_name}
                              className="flex items-start justify-between gap-3 p-3 rounded-xl bg-card/70 transition-colors hover:bg-card/90"
                              style={{
                                border: "1px solid rgba(255,255,255,0.22)",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-mono font-medium text-foreground truncate">{col.physical_name}</p>
                                {col.business_definition && (
                                  <p className="text-[11px] text-muted-foreground/80 mt-1 leading-relaxed line-clamp-2">
                                    {col.business_definition}
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
                                {typeTone && (
                                  <span
                                    className="inline-flex items-center rounded-full font-medium border capitalize leading-none"
                                    style={{
                                      backgroundColor: typeTone.backgroundColor,
                                      color: typeTone.color,
                                      borderColor: typeTone.borderColor,
                                      borderWidth: 1,
                                      borderStyle: "solid",
                                      padding: "5px 10px",
                                      fontSize: 11,
                                    }}
                                  >
                                    {col.semantic_type}
                                  </span>
                                )}
                                <span
                                  className="inline-flex items-center gap-1 rounded-full font-medium leading-none"
                                  style={{
                                    backgroundColor: statusTone.backgroundColor,
                                    color: statusTone.color,
                                    border: `1px solid ${statusTone.borderColor}`,
                                    padding: "5px 10px",
                                    fontSize: 11,
                                  }}
                                >
                                  <StatusIcon className="w-3 h-3 shrink-0" strokeWidth={2} style={{ color: statusTone.color }} />
                                  {statusLabel(col.status)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Relationships tab ── */}
                {rightPanelTab === "relationships" && (
                  <div key={selectedTable.physical_name} className="p-3 space-y-3 animate-in fade-in duration-200">
                    {/* Statistic cards */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Outgoing", value: tableRelationships.outgoing.length, icon: <ArrowUpRight className="w-3.5 h-3.5" />, color: "text-sky-400", bg: "bg-sky-500/10" },
                        { label: "Incoming", value: tableRelationships.incoming.length, icon: <ArrowDownLeft className="w-3.5 h-3.5" />, color: "text-violet-400", bg: "bg-violet-500/10" },
                        { label: "Metrics", value: metricEntries.length, icon: <TrendingUp className="w-3.5 h-3.5" />, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl border border-border/60 bg-card/60 p-2.5 text-center shadow-sm">
                          <div className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center mb-1.5 ${s.bg} ${s.color}`}>{s.icon}</div>
                          <p className={`text-[16px] font-bold leading-none tabular-nums ${s.color}`}>{s.value}</p>
                          <p className="text-[9px] text-muted-foreground/70 mt-1 uppercase tracking-wide">{s.label}</p>
                        </div>
                      ))}
                    </div>

                    {relCount === 0 ? (
                      <EmptyHint text="No relationships mapped yet." sub="Relationships are inferred from foreign keys and the ontology graph." />
                    ) : (
                      <>
                        {tableRelationships.outgoing.length > 0 && (
                          <PanelSection icon={<ArrowUpRight className="w-3.5 h-3.5" />} iconColor="text-sky-400/80" title={`Outgoing (${tableRelationships.outgoing.length})`}>
                            <div className="space-y-1">
                              {tableRelationships.outgoing.map((r, i) => (
                                <RelationshipRow key={`out-${i}`} dot="bg-sky-400" name={r.target} label={r.label} />
                              ))}
                            </div>
                          </PanelSection>
                        )}
                        {tableRelationships.incoming.length > 0 && (
                          <PanelSection icon={<ArrowDownLeft className="w-3.5 h-3.5" />} iconColor="text-violet-400/80" title={`Incoming (${tableRelationships.incoming.length})`}>
                            <div className="space-y-1">
                              {tableRelationships.incoming.map((r, i) => (
                                <RelationshipRow key={`in-${i}`} dot="bg-violet-400" name={r.source} label={r.label} />
                              ))}
                            </div>
                          </PanelSection>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* ── History tab ── */}
                {rightPanelTab === "history" && (
                  <div key={selectedTable.physical_name} className="p-3 animate-in fade-in duration-200">
                    <PanelSection icon={<Clock3 className="w-3.5 h-3.5" />} iconColor="text-muted-foreground/70" title="Change History">
                      <EmptyHint text="No history available." sub="Edits and approvals will appear here once you start reviewing." />
                    </PanelSection>
                  </div>
                )}
              </div>

              {/* Footer — View Technical Details temporarily hidden
              <div className="p-3 border-t border-border shrink-0">
                <Button variant="outline" size="sm" className="w-full text-[11px] gap-1.5 h-8"
                  onClick={() => { if (!expandedTables.has(selectedTable.physical_name)) toggleExpanded(selectedTable.physical_name); }}>
                  <Eye className="w-3.5 h-3.5" />
                  View Technical Details
                </Button>
              </div>
              */}
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
      )}

      {/* ══════════════ BUSINESS CONTEXT BODY ══════════════ */}
      {activeView === "business_context" && selectedDb && (
        <div className="flex-1 min-h-0 overflow-y-auto bg-background">
          <div className="max-w-5xl mx-auto px-6 py-6">

            {/* Page intro */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Business Context
                </h2>
                <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                  Metrics, reporting rules, and business terms captured through
                  <span className="text-foreground/80 font-medium"> Start Enriching</span>. Whatever the
                  assistant captures during a chat appears here once you apply it.
                </p>
              </div>
              <GradientButton onClick={handleStartEnriching}
                disabled={isEnriching || ontologyLoading || !hasCatalog || isPbitUploading}>
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Sparkles className="w-3 h-3" />
                  {isEnriching ? "Preparing…" : "Start Enriching"}
                </span>
              </GradientButton>
            </div>

            {/* Loading */}
            {ontologyLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg border border-border/40 bg-card/60 animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!ontologyLoading && !hasBusinessContext && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-foreground">No business context captured yet</p>
                <p className="text-[12px] text-muted-foreground max-w-md leading-relaxed">
                  Use <span className="text-foreground/80 font-medium">Start Enriching</span> to chat with the
                  assistant about your metrics, reporting rules, and business terms. Once you apply the
                  enrichment, everything captured will show up here.
                </p>
                <GradientButton onClick={handleStartEnriching}
                  disabled={isEnriching || ontologyLoading || !hasCatalog || isPbitUploading}>
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Sparkles className="w-3 h-3" />
                    {isEnriching ? "Preparing…" : "Start Enriching"}
                  </span>
                </GradientButton>
              </div>
            )}

            {/* Content */}
            {!ontologyLoading && hasBusinessContext && (
              <div className="space-y-6">

                {/* ── Metrics ── */}
                {metricEntries.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-[13px] font-semibold text-foreground">Metrics</h3>
                      <Badge variant="outline" className="text-[10px] px-3 py-0 h-[20px] rounded-full bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                        {metricEntries.length}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {metricEntries.map(([name, val]) => {
                        const description = typeof val === "object" && val ? val.description : typeof val === "string" ? val : undefined;
                        const formula = typeof val === "object" && val ? val.formula : undefined;
                        const status = typeof val === "object" && val ? val.status : undefined;
                        return (
                          <div key={name} className="rounded-lg border border-border/60 bg-card/70 p-3.5 shadow-sm">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-[13px] font-semibold text-foreground leading-tight">{name}</p>
                              {status && (
                                <StatusBadge status={status} />
                              )}
                            </div>
                            {description && (
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
                            )}
                            {formula && (
                              <code className="block text-[10px] text-emerald-400 font-mono mt-2 break-all bg-emerald-500/5 border border-emerald-500/15 rounded px-2 py-1.5">
                                {formula}
                              </code>
                            )}
                            {!description && !formula && (
                              <p className="text-[11px] text-muted-foreground/50 italic">Awaiting definition — continue enriching.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* ── Reporting Rules ── */}
                {ruleKeys.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <ListChecks className="w-4 h-4 text-sky-400" />
                      <h3 className="text-[13px] font-semibold text-foreground">Reporting Rules</h3>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/70 divide-y divide-border/40 shadow-sm">
                      {businessContext.rules.default_time_granularity && (
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                            <CalendarClock className="w-3.5 h-3.5 text-sky-400/70" /> Default Time Granularity
                          </span>
                          <span className="text-[12px] font-semibold text-sky-300 capitalize">
                            {String(businessContext.rules.default_time_granularity)}
                          </span>
                        </div>
                      )}
                      {businessContext.rules.default_time_dimension && (
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                          <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
                            <CalendarClock className="w-3.5 h-3.5 text-sky-400/70" /> Default Date Field
                          </span>
                          <code className="text-[11px] font-mono text-sky-300">
                            {String(businessContext.rules.default_time_dimension)}
                          </code>
                        </div>
                      )}
                      {Array.isArray(businessContext.rules.status_success_values) && businessContext.rules.status_success_values.length > 0 && (
                        <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                          <span className="flex items-center gap-2 text-[12px] text-muted-foreground shrink-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/70" /> Success Values
                          </span>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {businessContext.rules.status_success_values.map((v: string) => (
                              <span key={v} className="text-[10px] rounded bg-emerald-400/10 text-emerald-300 border border-emerald-400/20" style={{ padding: "4px 12px", display: "inline-flex" }}>{v}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {businessContext.rules.default_filters && typeof businessContext.rules.default_filters === "object" && Object.keys(businessContext.rules.default_filters).length > 0 && (
                        <div className="flex items-start justify-between gap-3 px-4 py-2.5">
                          <span className="flex items-center gap-2 text-[12px] text-muted-foreground shrink-0">
                            <Filter className="w-3.5 h-3.5 text-violet-400/70" /> Default Filters
                          </span>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {Object.entries(businessContext.rules.default_filters).map(([k, v]) => (
                              <code key={k} className="text-[10px] font-mono rounded bg-violet-500/10 text-violet-300 border border-violet-500/20" style={{ padding: "4px 12px", display: "inline-flex" }}>
                                {k} = {String(v)}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Any other custom rule keys */}
                      {ruleKeys
                        .filter((k) => !["default_time_granularity", "default_time_dimension", "status_success_values", "default_filters"].includes(k))
                        .map((k) => (
                          <div key={k} className="flex items-start justify-between gap-3 px-4 py-2.5">
                            <span className="text-[12px] text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
                            <code className="text-[11px] font-mono text-foreground/80 text-right break-all">
                              {typeof businessContext.rules[k] === "object" ? JSON.stringify(businessContext.rules[k]) : String(businessContext.rules[k])}
                            </code>
                          </div>
                        ))}
                    </div>
                  </section>
                )}

                {/* ── Business Terms / Aliases ── */}
                {businessContext.aliases.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-4 h-4 text-violet-400" />
                      <h3 className="text-[13px] font-semibold text-foreground">Business Terms</h3>
                      <Badge variant="outline" className="text-[10px] px-3 py-0 h-[20px] rounded-full bg-violet-500/10 text-violet-400 border-violet-500/20">
                        {businessContext.aliases.length}
                      </Badge>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-card/70 divide-y divide-border/40 shadow-sm">
                      {businessContext.aliases.map((a: any, i: number) => (
                        <div key={`${a.term}-${i}`} className="flex items-center gap-2 px-4 py-2.5">
                          <span className="text-[12px] font-medium text-violet-300">"{a.term}"</span>
                          <span className="text-[11px] text-muted-foreground">maps to</span>
                          <code className="text-[11px] font-mono text-foreground">{a.maps_to}</code>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════ WELCOME / CHOOSE DATASOURCE DIALOG ══════════════ */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-1 w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Database className="w-7 h-7 text-primary" />
            </div>
            <DialogTitle className="text-center">Welcome to Data Ontology Explorer</DialogTitle>
            <DialogDescription className="text-center">
              Choose an existing datasource connection to explore and enrich its business ontology.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-2">
            <label className="text-[12px] font-medium text-foreground">Datasource connection</label>
            <Select value={pendingDbId} onValueChange={setPendingDbId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a datasource" />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db.id} value={db.id}>
                    <span className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-primary/70 shrink-0" />
                      <span className="font-medium">{db.name}</span>
                      <span className="text-muted-foreground text-[11px]">{dbTypeLabel(db.type)}</span>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusDotColor(db.status)}`} />
                        {statusText(db.status)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {databases.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No database connections found. Connect a database from the Databases tab first.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleWelcomeCancel}>Cancel</Button>
            <Button onClick={handleWelcomeContinue} disabled={!pendingDbId} className="gap-1.5">
              Continue
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
