import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { ChartCard } from "../components/features/charts/ChartCard";
import type { ChartType } from "../components/features/charts/core/chartTypes";
import { coerceChartType } from "../utils/chartSpecNormalizer";
import { buildEmbedChartDisplayConfig } from "./embedChartDisplay";
import { useIframeHeightBroadcaster } from "./useIframeHeightBroadcaster";
import { DateRangePicker } from "./DateRangePicker";
import { useDateRange } from "./useDateRange";
import type {
  DashboardMetaResponse,
  EmbedChartMeta,
  EmbedChartState,
  EmbedTheme,
  TokenRefreshResponse,
} from "./types";

// ── Theme helpers ─────────────────────────────────────────────────────────────

/**
 * Detect whether a hex/rgb/hsl color string represents a "dark" background
 * by estimating relative luminance.
 */
function isColorDark(color: string): boolean {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  // Perceived luminance (ITU-R BT.709)
  const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
  return lum < 0.35;
}

/**
 * Apply theme and/or a custom background colour independently.
 *
 * Logic:
 *  - If `customBg` is provided → set --embed-bg and data-theme="custom";
 *    use luminance to add/remove .embed-bg-dark for text contrast.
 *  - The `.dark` class (for ECharts contrast) is driven by the explicit
 *    `theme` state when set, or falls back to luminance of `customBg` when
 *    no named theme has been provided.
 *  - When only a named theme is given (no customBg) → clear inline bg vars
 *    and set data-theme to "light" | "dark" as before.
 */
function applyEmbedTheme(theme: EmbedTheme | null, customBg?: string) {
  const html = document.documentElement;

  if (customBg) {
    html.setAttribute("data-theme", "custom");
    html.style.setProperty("--embed-bg", customBg);
    html.style.setProperty("--embed-card-bg", ""); // let CSS rule handle it

    const bgIsDark = isColorDark(customBg);
    if (bgIsDark) {
      html.classList.add("embed-bg-dark");
    } else {
      html.classList.remove("embed-bg-dark");
    }

    // Prefer explicit theme for ECharts dark class; fall back to luminance
    if (theme === "dark" || (theme === null && bgIsDark)) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    return;
  }

  // No custom background — clear inline vars and apply named theme
  html.style.removeProperty("--embed-bg");
  html.style.removeProperty("--embed-card-bg");
  html.classList.remove("embed-bg-dark");

  if (theme === null) return; // stay transparent
  html.setAttribute("data-theme", theme);
  if (theme === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

/** Detect system preference as a fallback when parent sends no theme. */
function systemPrefersDark(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

const REFRESH_INTERVAL_MS = 60_000;
const JWT_REFRESH_INTERVAL_MS = 25 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;

function normalizeEmbedChartType(raw: string | null | undefined): ChartType {
  const normalized = (raw ?? "line").toLowerCase();
  if (normalized === "column") return "bar";
  return coerceChartType(raw);
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) => {
      window.setTimeout(() => reject(new Error("Request timeout")), timeoutMs);
    }),
  ]);
}

// ── Height Broadcaster ────────────────────────────────────────────────────────
// Height broadcasting is handled by useIframeHeightBroadcaster() which is
// called at the top level of EmbedApp. The hook owns ResizeObserver,
// MutationObserver, rAF coalescing, and deduplication internally.

// ── Chart-level Error Boundary ────────────────────────────────────────────────

interface ChartErrorBoundaryProps {
  chartTitle: string;
  children: ReactNode;
}
interface ChartErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: unknown): ChartErrorBoundaryState {
    return {
      hasError: true,
      message:
        error instanceof Error ? error.message : "Chart render failed",
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error(
      "[EMBED][ChartErrorBoundary] Chart render error:",
      this.props.chartTitle,
      error,
      info,
    );
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="error-state">
          Chart could not be rendered.
          {import.meta.env.DEV && (
            <span style={{ display: "block", fontSize: 11, marginTop: 4, opacity: 0.7 }}>
              {this.state.message}
            </span>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── EmbedChartCard — memoised per-chart render ────────────────────────────────

interface EmbedChartCardProps {
  chart: EmbedChartState;
  index: number;
  apiBase: string;
  tokenId: string;
  getAuthHeaders: () => Record<string, string>;
  onDateChange: (chartId: string, start: string, end: string) => void;
}

function EmbedChartCard({
  chart,
  index,
  apiBase,
  tokenId,
  getAuthHeaders,
  onDateChange,
}: EmbedChartCardProps) {
  const display = useMemo(
    () =>
      buildEmbedChartDisplayConfig(
        chart.rows,
        chart.type,
        chart.xAxis,
        chart.yAxis,
      ),
    [chart.rows, chart.type, chart.xAxis, chart.yAxis],
  );

  /**
   * Detect whether a chart is likely time-based even when the DB flag is not set.
   * Checks (in priority order):
   *   1. meta.is_time_based flag from the backend
   *   2. Whether the x_axis value in the first data row parses as a date / datetime
   */
  const isLikelyTimeBased = useMemo(() => {
    if (chart.meta.is_time_based) return true;
    // Only sniff when we have rows and an x_axis column name
    const col = chart.xAxis;
    if (!col || !chart.rows || chart.rows.length === 0) return false;
    const sample = chart.rows[0][col];
    if (!sample) return false;
    // Accept ISO date strings (YYYY-MM-DD…) or epoch-like numbers
    if (typeof sample === "string") {
      return /^\d{4}-\d{2}-\d{2}/.test(sample) || !isNaN(Date.parse(sample));
    }
    return false;
  }, [chart.meta.is_time_based, chart.xAxis, chart.rows]);

  // Fetch date bounds for any chart that has an x_axis and appears time-based
  const { minDate, maxDate, isLoading: rangeLoading } = useDateRange({
    apiBase,
    tokenId,
    chartId: chart.meta.id,
    enabled: isLikelyTimeBased || (!!chart.xAxis && !chart.isLoading),
    getAuthHeaders,
  });

  // Show the picker only when the backend actually returned date bounds
  // (handles the case where is_time_based is false but dates came back anyway)
  const hasRange = !!minDate && !!maxDate;

  // Current picker selection (falls back to full range when no selection yet)
  const currentStart = chart.dateRange?.start ?? minDate ?? "";
  const currentEnd   = chart.dateRange?.end   ?? maxDate ?? "";

  return (
    <div className="chart-card" key={chart.meta.id}>
      <h3>{chart.meta.title || "Chart"}</h3>

      {/* Date range picker — shown when the backend returned actual date bounds */}
      {!rangeLoading && hasRange && !chart.isLoading && (
        <DateRangePicker
          id={`date-picker-${chart.meta.id}`}
          minDate={minDate!}
          maxDate={maxDate!}
          startDate={currentStart}
          endDate={currentEnd}
          isLoading={chart.isRefetchingDateFilter}
          onChange={(start, end) => onDateChange(chart.meta.id, start, end)}
        />
      )}
      {/* Skeleton while range bounds are loading (only shown when we expect a picker) */}
      {isLikelyTimeBased && rangeLoading && !chart.isLoading && (
        <div className="date-range-picker date-range-picker--skeleton" aria-hidden="true" />
      )}

      <div className="chart-container" id={`chart-${index}`}>
        {chart.isLoading ? (
          <div className="skeleton" />
        ) : chart.error ? (
          <div className="error-state">{chart.error}</div>
        ) : display.data.length > 0 ? (
          <ChartErrorBoundary chartTitle={chart.meta.title || "Chart"}>
            <ChartCard
              type={display.effectiveType}
              data={display.data}
              dataKeys={display.dataKeys}
              xAxisKey={display.xAxisKey}
              axisConfig={display.axisConfig}
              height={280}
              showLegend={
                display.dataKeys.length > 1 &&
                display.effectiveType !== "pie" &&
                display.effectiveType !== "donut"
              }
            />
          </ChartErrorBoundary>
        ) : (
          <div className="error-state">No data available</div>
        )}
      </div>
    </div>
  );
}

// ── EmbedApp ──────────────────────────────────────────────────────────────────

interface EmbedAppProps {
  tokenId: string;
  apiBase: string;
  dashboardTitle: string;
  charts: EmbedChartMeta[];
  initialAccessToken?: string;
}

export function EmbedApp({
  tokenId,
  apiBase,
  dashboardTitle: initialTitle,
  charts: initialChartMetas,
  initialAccessToken,
}: EmbedAppProps) {
  // Height broadcasting — delegates to the dedicated hook (ResizeObserver +
  // MutationObserver + rAF coalescing + deduplication).
  useIframeHeightBroadcaster();

  // Start with null = "auto" — we apply it after mount based on parent signal
  // or system preference, avoiding a flash of the wrong theme.
  // theme and customBg are fully independent: each postMessage type updates
  // only its own slice of state.
  const [theme, setTheme] = useState<EmbedTheme | null>(null);
  const [customBg, setCustomBg] = useState<string | undefined>(undefined);
  const [dashboardTitle, setDashboardTitle] = useState(initialTitle);
  const [charts, setCharts] = useState<EmbedChartState[]>(() =>
    initialChartMetas.map((meta) => ({
      meta,
      type: normalizeEmbedChartType(meta.chart_type),
      xAxis: meta.x_axis,
      yAxis: meta.y_axis,
      rows: null,
      isLoading: true,
      error: null,
      dateRange: null,
      isRefetchingDateFilter: false,
    })),
  );

  const refreshTimerRef = useRef<number | null>(null);
  const jwtRefreshTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const accessTokenRef = useRef<string | undefined>(initialAccessToken);
  const isRefreshingRef = useRef(false);

  // ── Keep a ref to the latest chart metas to avoid stale closures ──────────
  // This is the key fix: instead of putting chartMetas in useCallback deps
  // (which causes cascading recreations), we keep a ref that's always current.
  const chartMetasRef = useRef<EmbedChartMeta[]>(initialChartMetas);

  // Stable ref for handleChartDateChange — keeps the postMessage bridge's
  // onMessage closure from going stale. The ref is set after handleChartDateChange
  // is defined below; reads happen only when a message arrives (after mount).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleChartDateChangeRef = useRef<(id: string, s: string, e: string) => void>(
    () => { /* populated after handleChartDateChange is defined */ },
  );

  useEffect(() => {
    // Apply whenever either theme or customBg changes.
    // applyEmbedTheme handles the null-theme "stay transparent" case internally.
    applyEmbedTheme(theme, customBg);
  }, [theme, customBg]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log("[EMBED][STEP 9] Static assets loaded in embed context");

    // ── postMessage bridge ────────────────────────────────────────────────
    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { type, value } = event.data as { type: string; value?: string };

      // Named theme: "light" | "dark" — only updates theme, never clears customBg
      if (type === "set_theme") {
        const next: EmbedTheme = value === "light" ? "light" : "dark";
        setTheme(next);
        console.log("[EMBED] Theme set to:", next);
      }

      // Custom background colour — only updates customBg, never clears theme
      if (type === "set_background" && typeof value === "string" && value.trim()) {
        setCustomBg(value.trim());
        console.log("[EMBED] Custom background applied:", value.trim());
      }

      // Date range filter pushed from the parent page.
      // Applies to all time-based charts in the embed — does NOT affect the
      // VizAI dashboard for authenticated users.
      if (type === "set_filters" && value && typeof value === "object") {
        const { start_date, end_date } = value as {
          start_date?: string;
          end_date?: string;
        };
        if (start_date && end_date) {
          console.log("[EMBED] Parent date filter received:", start_date, "→", end_date);
          // We read the current chart list via ref to avoid a stale closure
          const metas = chartMetasRef.current;
          metas
            .filter((m) => m.is_time_based)
            .forEach((m) => {
              void handleChartDateChangeRef.current(m.id, start_date, end_date);
            });
        }
      }
    };

    window.addEventListener("message", onMessage);

    // ── Notify parent ─────────────────────────────────────────────────────
    // request_theme prompts the parent to reply with set_theme / set_background.
    window.parent.postMessage({ type: "request_theme" }, "*");
    console.log("[EMBED] Requested parent theme via postMessage");

    // ── Standalone fallback (no parent frame) ─────────────────────────────
    const isEmbedded = window.self !== window.top;
    const fallbackTimer = window.setTimeout(() => {
      setTheme((prev) => {
        if (prev !== null) return prev; // parent already responded
        if (isEmbedded) {
          console.log("[EMBED] No theme received from parent — staying transparent");
          return null;
        }
        const detected: EmbedTheme = systemPrefersDark() ? "dark" : "light";
        console.log("[EMBED] Standalone mode — using system theme:", detected);
        return detected;
      });
    }, 400);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  // Token helpers

  /** Build Authorization headers using the embed session JWT */
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = accessTokenRef.current;
    if (!token) {
      return { "Content-Type": "application/json" };
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, []);

  /**
   * Refresh embed JWT (~25m). Verifies current JWT + rechecks share token server-side.
   */
  const doRefresh = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    if (!accessTokenRef.current) return false;

    isRefreshingRef.current = true;
    try {
      const res = await fetchWithTimeout(
        `${apiBase}/api/v1/embed/token/refresh`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessTokenRef.current}`,
          },
          body: JSON.stringify({ share_token: tokenId }),
        },
        FETCH_TIMEOUT_MS,
      );

      if (!res.ok) {
        console.warn("[EMBED] JWT refresh failed:", res.status);
        return false;
      }

      const payload: TokenRefreshResponse = await res.json();
      accessTokenRef.current = payload.access_token;
      console.log("[EMBED] Embed JWT refreshed successfully");
      return true;
    } catch (err) {
      console.error("[EMBED] JWT refresh error:", err);
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [apiBase, tokenId]);

  //  Data fetching
  const fetchChartData = useCallback(
    async (
      chartId: string,
      startDate?: string,
      endDate?: string,
    ): Promise<{
      rows: Record<string, unknown>[] | null;
      error: string | null;
      xAxis?: string | null;
      yAxis?: string | null;
      chartType?: string;
    }> => {
      const doFetch = async (isRetry: boolean): Promise<{
        rows: Record<string, unknown>[] | null;
        error: string | null;
        xAxis?: string | null;
        yAxis?: string | null;
        chartType?: string;
      }> => {
        try {
          // Build URL with optional date range params
          const baseUrl = `${apiBase}/api/v1/embed/${tokenId}/data/${chartId}`;
          const params = new URLSearchParams();
          if (startDate) params.set("start_date", startDate);
          if (endDate)   params.set("end_date",   endDate);
          const url = params.toString() ? `${baseUrl}?${params}` : baseUrl;

          const response = await fetchWithTimeout(
            url,
            { headers: getAuthHeaders() },
            FETCH_TIMEOUT_MS,
          );

          if (response.status === 403) {
            const body = await response.json().catch(() => ({}));
            const errorCode = body?.detail?.error;

            if (
              (errorCode === "jwt_expired" || errorCode === "access_token_expired") &&
              !isRetry
            ) {
              const refreshed = await doRefresh();
              if (refreshed) {
                return doFetch(true);
              }
            }

            console.log(
              "[EMBED][STEP 13] Token expiry detected mid-session — showing expired UI",
            );
            return {
              rows: null,
              error:
                "This embed link has expired. Please contact the dashboard owner.",
            };
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = (await response.json()) as {
            data?: Record<string, unknown>[];
            x_axis?: string | null;
            y_axis?: string | null;
            chart_type?: string;
          };

          console.log(
            "[EMBED][STEP 10a] Loading state shown; data fetch result: success",
          );

          return {
            rows: payload.data ?? [],
            error: null,
            xAxis: payload.x_axis,
            yAxis: payload.y_axis,
            chartType: payload.chart_type,
          };
        } catch (err) {
          console.error(
            "[EMBED][STEP 10a] Loading state shown; data fetch result: error",
            err,
          );
          return { rows: null, error: "Dashboard data unavailable" };
        }
      };

      return doFetch(false);
    },
    [apiBase, tokenId, getAuthHeaders, doRefresh],
  );

  // Dynamic chart discovery

  const fetchDashboardMeta = useCallback(async (): Promise<DashboardMetaResponse | null> => {
    const doFetch = async (isRetry: boolean): Promise<DashboardMetaResponse | null> => {
      try {
        const res = await fetchWithTimeout(
          `${apiBase}/api/v1/embed/${tokenId}/dashboard`,
          { headers: getAuthHeaders() },
          FETCH_TIMEOUT_MS,
        );

        if (res.status === 403) {
          const body = await res.json().catch(() => ({}));
          const errCode = body?.detail?.error;
          if (
            (errCode === "jwt_expired" || errCode === "access_token_expired") &&
            !isRetry
          ) {
            const refreshed = await doRefresh();
            if (refreshed) return doFetch(true);
          }
          return null;
        }

        if (!res.ok) return null;
        return (await res.json()) as DashboardMetaResponse;
      } catch {
        return null;
      }
    };

    return doFetch(false);
  }, [apiBase, tokenId, getAuthHeaders, doRefresh]);

  // Chart loading

  /** Load data for a specific subset of chart IDs */
  const loadChartsById = useCallback(
    async (chartIds: string[]) => {
      const results = await Promise.all(
        chartIds.map(async (id) => {
          const result = await fetchChartData(id);
          return { id, result };
        }),
      );

      if (!isMountedRef.current) return;

      setCharts((prev) =>
        prev.map((c) => {
          const found = results.find((r) => r.id === c.meta.id);
          if (!found) return c;
          const { result } = found;
          const type = normalizeEmbedChartType(
            result.chartType ?? c.meta.chart_type,
          );
          return {
            ...c,
            type,
            xAxis: result.xAxis ?? c.xAxis,
            yAxis: result.yAxis ?? c.yAxis,
            rows: result.rows,
            isLoading: false,
            dateRange: null,
            isRefetchingDateFilter: false,
            error: result.error
              ? result.error
              : result.rows && result.rows.length > 0
                ? null
                : "No data available",
          };
        }),
      );

      // Height change is picked up automatically by useIframeHeightBroadcaster
    },
    [fetchChartData],
  );

  /**
   * Handle date range change for a single time-based chart card.
   * Fires a filtered API call and updates only that chart's rows.
   * Does NOT affect the VizAI dashboard state.
   */
  const handleChartDateChange = useCallback(
    async (chartId: string, start: string, end: string) => {
      // Mark that specific card as refetching
      setCharts((prev) =>
        prev.map((c) =>
          c.meta.id === chartId
            ? {
                ...c,
                isRefetchingDateFilter: true,
                dateRange: c.dateRange
                  ? { ...c.dateRange, start, end }
                  : { min: start, max: end, start, end, isLoading: false },
              }
            : c,
        ),
      );

      const result = await fetchChartData(chartId, start, end);

      if (!isMountedRef.current) return;

      setCharts((prev) =>
        prev.map((c) => {
          if (c.meta.id !== chartId) return c;
          return {
            ...c,
            rows: result.rows,
            isRefetchingDateFilter: false,
            error: result.error
              ? result.error
              : result.rows && result.rows.length > 0
                ? null
                : "No data available for the selected range",
            dateRange: c.dateRange
              ? { ...c.dateRange, start, end, isLoading: false }
              : { min: start, max: end, start, end, isLoading: false },
          };
        }),
      );
    },
    [fetchChartData],
  );

  /**
   * Load all charts.
   * CRITICAL FIX: reads current metas from ref (not stale closure) so
   * this callback's identity never needs to change when metas update —
   * eliminating the useEffect([loadAllCharts]) re-trigger loop.
   */
  const loadAllCharts = useCallback(async () => {
    // Read latest metas from ref to avoid stale-closure dependency
    const currentMetas = chartMetasRef.current;

    setCharts((prev) =>
      prev.map((c) => ({ ...c, isLoading: true, error: null })),
    );

    let loadedCount = 0;
    const results = await Promise.all(
      currentMetas.map(async (meta) => {
        const result = await fetchChartData(meta.id);
        return { meta, result };
      }),
    );

    if (!isMountedRef.current) return;

    setCharts(
      results.map(({ meta, result }) => {
        const type = normalizeEmbedChartType(
          result.chartType ?? meta.chart_type,
        );
        if (result.error) {
          return {
            meta,
            type,
            xAxis: result.xAxis ?? meta.x_axis,
            yAxis: result.yAxis ?? meta.y_axis,
            rows: null,
            isLoading: false,
            error: result.error,
            dateRange: null,
            isRefetchingDateFilter: false,
          };
        }
        if (result.rows && result.rows.length > 0) {
          loadedCount += 1;
        }
        return {
          meta,
          type,
          xAxis: result.xAxis ?? meta.x_axis,
          yAxis: result.yAxis ?? meta.y_axis,
          rows: result.rows,
          isLoading: false,
          error:
            result.rows && result.rows.length > 0
              ? null
              : "No data available",
          dateRange: null,
          isRefetchingDateFilter: false,
        };
      }),
    );

    console.log(
      `[EMBED][STEP 10] Chart data fetched — ${loadedCount} charts loaded successfully`,
    );
    console.log(
      `[EMBED][STEP 11] Dashboard fully rendered in embed — ${loadedCount} charts visible`,
    );
    // Height change is picked up automatically by useIframeHeightBroadcaster
    // CRITICAL: fetchChartData is the only real dep; chartMetas is read via ref
  }, [fetchChartData]);

  /**
   * Reconcile newly fetched chart metadata with existing state.
   * Handles: new charts, removed charts, renamed charts,
   * chart type changes, axis changes.
   *
   * CRITICAL FIX: Does NOT update chartMetasRef or call loadAllCharts directly
   * to avoid cascade. Instead updates the ref and returns newly added IDs for
   * the caller to load.
   */
  const reconcileCharts = useCallback(
    (newMetas: EmbedChartMeta[]) => {
      // Always keep the ref current
      const prevMetas = chartMetasRef.current;
      chartMetasRef.current = newMetas;

      const newIds = new Set(newMetas.map((m) => m.id));
      const existingIds = new Set(prevMetas.map((m) => m.id));

      // Charts to add (newly discovered)
      const added = newMetas.filter((m) => !existingIds.has(m.id));
      // Charts to remove (no longer in dashboard)
      const removed = new Set(
        prevMetas.filter((m) => !newIds.has(m.id)).map((m) => m.id),
      );

      setCharts((prev) => {
        // Remove charts no longer in dashboard
        let updated = prev.filter((c) => !removed.has(c.meta.id));

        // Update metadata for existing charts
        updated = updated.map((c) => {
          const freshMeta = newMetas.find((m) => m.id === c.meta.id);
          if (!freshMeta) return c;
          const typeChanged = freshMeta.chart_type !== c.meta.chart_type;
          const axisChanged =
            freshMeta.x_axis !== c.meta.x_axis ||
            freshMeta.y_axis !== c.meta.y_axis;
          const titleChanged = freshMeta.title !== c.meta.title;

          if (typeChanged || axisChanged || titleChanged) {
            return {
              ...c,
              meta: freshMeta,
              type: normalizeEmbedChartType(freshMeta.chart_type),
              xAxis: freshMeta.x_axis,
              yAxis: freshMeta.y_axis,
            };
          }
          return c;
        });

        // Append newly discovered charts
        const newEntries: EmbedChartState[] = added.map((meta) => ({
          meta,
          type: normalizeEmbedChartType(meta.chart_type),
          xAxis: meta.x_axis,
          yAxis: meta.y_axis,
          rows: null,
          isLoading: true,
          error: null,
          dateRange: null,
          isRefetchingDateFilter: false,
        }));

        return [...updated, ...newEntries];
      });

      if (added.length > 0) {
        console.log(
          `[EMBED] Dynamic chart discovery — ${added.length} new chart(s) found`,
        );
        void loadChartsById(added.map((m) => m.id));
      }

      if (removed.size > 0) {
        console.log(
          `[EMBED] Dynamic chart removal — ${removed.size} chart(s) removed`,
        );
        // Height change is picked up automatically by useIframeHeightBroadcaster
      }
    },
    // CRITICAL FIX: no chartMetas state dep — reads via ref instead
    [loadChartsById],
  );

  // ── Initial data load — fires exactly once on mount ───────────────────────
  // CRITICAL FIX: use a stable ref-based trigger instead of [loadAllCharts]
  // to prevent the effect from re-firing every time loadAllCharts is recreated.
  const initialLoadDoneRef = useRef(false);
  useEffect(() => {
    if (initialLoadDoneRef.current) return;
    initialLoadDoneRef.current = true;
    void loadAllCharts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount only

  // Proactive JWT refresh at 25 minutes
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        void doRefresh();
      }
    };
    jwtRefreshTimerRef.current = window.setInterval(tick, JWT_REFRESH_INTERVAL_MS);
    return () => {
      if (jwtRefreshTimerRef.current !== null) {
        window.clearInterval(jwtRefreshTimerRef.current);
      }
    };
  }, [doRefresh]);

  // Refresh cycle (data + dynamic discovery)
  // CRITICAL FIX: use stable refs for loadAllCharts and reconcileCharts
  // so the effect only re-runs when fetchDashboardMeta changes (apiBase/tokenId).
  const loadAllChartsRef = useRef(loadAllCharts);
  const reconcileChartsRef = useRef(reconcileCharts);
  useEffect(() => { loadAllChartsRef.current = loadAllCharts; }, [loadAllCharts]);
  useEffect(() => { reconcileChartsRef.current = reconcileCharts; }, [reconcileCharts]);
  // Keep handleChartDateChangeRef (declared near the top of the component) current
  useEffect(() => { handleChartDateChangeRef.current = handleChartDateChange; }, [handleChartDateChange]);

  useEffect(() => {
    const startRefreshCycle = () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setInterval(async () => {
        const visible = document.visibilityState === "visible";
        console.log(
          `[EMBED][STEP 14] Data refresh cycle — tab visible: ${visible}, next refresh in ${REFRESH_INTERVAL_MS / 1000}s`,
        );
        if (visible) {
          // Step 1: Discover chart changes
          const meta = await fetchDashboardMeta();
          if (meta && isMountedRef.current) {
            if (meta.dashboard_title !== dashboardTitle) {
              setDashboardTitle(meta.dashboard_title);
            }
            reconcileChartsRef.current(meta.charts);
          }
          // Step 2: Reload data for all current charts
          void loadAllChartsRef.current();
        }
      }, REFRESH_INTERVAL_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[EMBED][STEP 14] Tab became visible — resuming refresh");
        startRefreshCycle();
      } else {
        console.log("[EMBED][STEP 14] Tab hidden — pausing refresh");
        if (refreshTimerRef.current !== null) {
          window.clearInterval(refreshTimerRef.current);
          refreshTimerRef.current = null;
        }
      }
    };

    startRefreshCycle();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // Only re-run when the API connection changes (apiBase/tokenId change via fetchDashboardMeta)
    // dashboardTitle is read from current state inside the callback so no dep needed
  }, [fetchDashboardMeta]);

  // Render

  return (
    <>
      <div className="embed-header">
        <h1 id="dashboard-title">{dashboardTitle}</h1>
        <div className="subtitle">Powered by VizAI</div>
      </div>

      <div className="charts-grid" id="charts-grid">
        {charts.map((chart, index) => (
          <EmbedChartCard
            key={chart.meta.id}
            chart={chart}
            index={index}
            apiBase={apiBase}
            tokenId={tokenId}
            getAuthHeaders={getAuthHeaders}
            onDateChange={handleChartDateChange}
          />
        ))}
      </div>

      <div className="powered-by">
        Embedded Dashboard · VizAI Analytics
      </div>
    </>
  );
}
