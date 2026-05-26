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
 * Apply a named theme (light | dark) or a custom background colour.
 * Updates:
 *  - html[data-theme]
 *  - html.dark  (for ECharts / ChartCard dark-mode detection)
 *  - html.embed-bg-dark  (for custom-bg dark-text variant)
 *  - html style --embed-bg (custom mode only)
 */
function applyEmbedTheme(theme: EmbedTheme, customBg?: string) {
  const html = document.documentElement;

  if (theme === "custom" && customBg) {
    html.setAttribute("data-theme", "custom");
    html.style.setProperty("--embed-bg", customBg);
    html.style.setProperty("--embed-card-bg", ""); // let CSS rule handle it
    if (isColorDark(customBg)) {
      html.classList.add("dark", "embed-bg-dark");
    } else {
      html.classList.remove("dark", "embed-bg-dark");
    }
    return;
  }

  // Clear any inline custom-bg property
  html.style.removeProperty("--embed-bg");
  html.style.removeProperty("--embed-card-bg");
  html.classList.remove("embed-bg-dark");

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
// Sends the dashboard's total content height to the parent so the <iframe> can
// auto-expand.  Three safeguards:
//   1. Uses documentElement.scrollHeight (accurate for grid/flex layouts).
//   2. Deduplicates: skips postMessage when height hasn't changed.
//   3. Wraps in rAF: prevents "ResizeObserver loop limit exceeded" errors.

let _lastBroadcastHeight = 0;
let _heightRafId: number | null = null;
let _heightLoggedOnce = false;

/**
 * Measure the full document height and send it to the parent window.
 * Safe to call from any context (ResizeObserver, MutationObserver, async code).
 * Coalesces rapid calls via requestAnimationFrame and skips duplicate values.
 */
function sendEmbedHeight() {
  // Cancel any pending rAF to coalesce rapid successive calls
  if (_heightRafId !== null) {
    cancelAnimationFrame(_heightRafId);
  }

  _heightRafId = requestAnimationFrame(() => {
    _heightRafId = null;

    // documentElement.scrollHeight is the most reliable cross-browser measurement
    // for total content height, including grid/flex children and overflows.
    const height = Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    );

    // Deduplicate: don't flood the parent with identical height messages
    if (height === _lastBroadcastHeight) return;
    _lastBroadcastHeight = height;

    window.parent.postMessage({ type: "embed_ready", height }, "*");

    if (!_heightLoggedOnce) {
      _heightLoggedOnce = true;
      console.log(
        `[EMBED][STEP 12] postMessage bridge active — initial height: ${height}px`,
      );
    }
  });
}

// (applyTheme replaced by applyEmbedTheme above)

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
}

function EmbedChartCard({ chart, index }: EmbedChartCardProps) {
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

  return (
    <div className="chart-card" key={chart.meta.id}>
      <h3>{chart.meta.title || "Chart"}</h3>
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
              height={320}
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
  // Start with null = "auto" — we apply it after mount based on parent signal
  // or system preference, avoiding a flash of the wrong theme.
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

  useEffect(() => {
    // Only apply a theme when explicitly set — when theme is null we leave
    // the :root transparent defaults in place so the parent bg shows through.
    if (theme === null) return;
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
    sendEmbedHeight();

    // ── ResizeObserver: fires when body dimensions change (window resize,
    //    content reflow, chart render).  sendEmbedHeight already wraps in
    //    rAF internally, so this is safe from loop-limit errors.
    const resizeObserver = new ResizeObserver(() => {
      sendEmbedHeight();
    });
    resizeObserver.observe(document.body);
    resizeObserver.observe(document.documentElement);

    // ── MutationObserver: catches dynamic chart additions/removals that
    //    change the DOM tree height without triggering a body resize
    //    (e.g. a new chart card appended to .charts-grid).
    const chartsGrid = document.getElementById("charts-grid");
    const mutationObserver = new MutationObserver(() => {
      sendEmbedHeight();
    });
    if (chartsGrid) {
      mutationObserver.observe(chartsGrid, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    // ── postMessage bridge ────────────────────────────────────────────────
    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const { type, value } = event.data as { type: string; value?: string };

      // Named theme: "light" | "dark"
      if (type === "set_theme") {
        const next: EmbedTheme = value === "light" ? "light" : "dark";
        setTheme(next);
        setCustomBg(undefined);
        console.log("[EMBED] Theme set to:", next);
      }

      // Custom background colour (any CSS colour string)
      if (type === "set_background" && typeof value === "string" && value.trim()) {
        setTheme("custom");
        setCustomBg(value.trim());
        console.log("[EMBED] Custom background applied:", value.trim());
      }

      if (type === "set_filters") {
        console.log("[EMBED] Filters received:", value);
      }
    };

    window.addEventListener("message", onMessage);

    // ── Notify parent ─────────────────────────────────────────────────────
    // Send embed_ready (height) + request_theme so the parent can respond.
    window.parent.postMessage({ type: "embed_ready", height: document.body.scrollHeight }, "*");
    window.parent.postMessage({ type: "request_theme" }, "*");
    console.log("[EMBED] Requested parent theme via postMessage");

    // ── Standalone fallback (no parent frame) ─────────────────────────────
    // When the embed page is opened directly (not in an iframe) there is no
    // parent to respond. Detect this and apply system preference as fallback.
    const isEmbedded = window.self !== window.top;
    const fallbackTimer = window.setTimeout(() => {
      setTheme((prev) => {
        if (prev !== null) return prev; // parent already responded
        if (isEmbedded) {
          // Inside an iframe but parent sent nothing — stay transparent.
          console.log("[EMBED] No theme received from parent — staying transparent");
          return null;
        }
        // Standalone page: use system preference
        const detected: EmbedTheme = systemPrefersDark() ? "dark" : "light";
        console.log("[EMBED] Standalone mode — using system theme:", detected);
        return detected;
      });
    }, 400);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("message", onMessage);
      window.clearTimeout(fallbackTimer);
      // Cancel any pending height broadcast rAF
      if (_heightRafId !== null) {
        cancelAnimationFrame(_heightRafId);
        _heightRafId = null;
      }
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
    async (chartId: string): Promise<{
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
          const response = await fetchWithTimeout(
            `${apiBase}/api/v1/embed/${tokenId}/data/${chartId}`,
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
            error: result.error
              ? result.error
              : result.rows && result.rows.length > 0
                ? null
                : "No data available",
          };
        }),
      );

      sendEmbedHeight();
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
        };
      }),
    );

    console.log(
      `[EMBED][STEP 10] Chart data fetched — ${loadedCount} charts loaded successfully`,
    );
    console.log(
      `[EMBED][STEP 11] Dashboard fully rendered in embed — ${loadedCount} charts visible`,
    );
    sendEmbedHeight();
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
        sendEmbedHeight();
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
          />
        ))}
      </div>

      <div className="powered-by">
        Embedded Dashboard · VizAI Analytics
      </div>
    </>
  );
}
