import { useCallback, useEffect, useRef, useState } from "react";

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

const REFRESH_INTERVAL_MS = 60_000;
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

let embedHeightLogged = false;

function sendEmbedHeight() {
  const height = document.body.scrollHeight;
  window.parent.postMessage({ type: "embed_ready", height }, "*");
  if (!embedHeightLogged) {
    embedHeightLogged = true;
    console.log(
      `[EMBED][STEP 12] postMessage bridge active — initial height: ${height}px`,
    );
  }
}

function applyTheme(theme: EmbedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  if (theme === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }
}

interface EmbedAppProps {
  tokenId: string;
  apiBase: string;
  dashboardTitle: string;
  charts: EmbedChartMeta[];
  initialAccessToken?: string;
  initialRefreshToken?: string;
  initialExpiresIn?: number;
}

export function EmbedApp({
  tokenId,
  apiBase,
  dashboardTitle: initialTitle,
  charts: initialChartMetas,
  initialAccessToken,
  initialRefreshToken,
  initialExpiresIn,
}: EmbedAppProps) {
  const [theme, setTheme] = useState<EmbedTheme>("dark");
  const [dashboardTitle, setDashboardTitle] = useState(initialTitle);
  const [chartMetas, setChartMetas] = useState<EmbedChartMeta[]>(initialChartMetas);
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
  const [renderGeneration, setRenderGeneration] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  //Token state 
  const accessTokenRef = useRef<string | undefined>(initialAccessToken);
  const refreshTokenRef = useRef<string | undefined>(initialRefreshToken);
  const isRefreshingRef = useRef(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    console.log("[EMBED][STEP 9] Static assets loaded in embed context");
    sendEmbedHeight();

    const resizeObserver = new ResizeObserver(() => {
      sendEmbedHeight();
    });
    resizeObserver.observe(document.body);

    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "set_theme") {
        const next =
          event.data.value === "light" ? "light" : ("dark" as EmbedTheme);
        setTheme(next);
        console.log("[EMBED][STEP 12] Theme set to: " + next);
      }
      if (event.data.type === "set_filters") {
        console.log("[EMBED][STEP 12] Filters received:", event.data.value);
      }
    };

    window.addEventListener("message", onMessage);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("message", onMessage);
    };
  }, []);

  // Token helpers

  /** Build Authorization headers using the current access token */
  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = accessTokenRef.current || tokenId;
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, [tokenId]);

  /**
   * Attempt to refresh the access token using the refresh token.
   * Returns true if successful, false otherwise.
   * Guards against concurrent calls via isRefreshingRef.
   */
  const doRefresh = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    if (!refreshTokenRef.current) return false;

    isRefreshingRef.current = true;
    try {
      const res = await fetchWithTimeout(
        `${apiBase}/api/v1/embed/token/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            refresh_token: refreshTokenRef.current,
            share_token: tokenId,
          }),
        },
        FETCH_TIMEOUT_MS,
      );

      if (!res.ok) {
        console.warn("[EMBED] Token refresh failed:", res.status);
        return false;
      }

      const payload: TokenRefreshResponse = await res.json();
      accessTokenRef.current = payload.access_token;
      refreshTokenRef.current = payload.refresh_token;
      console.log("[EMBED] Access token refreshed successfully");
      return true;
    } catch (err) {
      console.error("[EMBED] Token refresh error:", err);
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

            // If access token expired and we haven't retried yet, refresh
            if (errorCode === "access_token_expired" && !isRetry) {
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
          if (body?.detail?.error === "access_token_expired" && !isRetry) {
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

  /**
   * Reconcile newly fetched chart metadata with existing state.
   * Handles: new charts, removed charts, renamed charts,
   * chart type changes, axis changes.
   */
  const reconcileCharts = useCallback(
    (newMetas: EmbedChartMeta[]) => {
      setChartMetas(newMetas);

      const newIds = new Set(newMetas.map((m) => m.id));
      const existingIds = new Set(chartMetas.map((m) => m.id));

      // Charts to add (newly discovered)
      const added = newMetas.filter((m) => !existingIds.has(m.id));
      // Charts to remove (no longer in dashboard)
      const removed = new Set(
        chartMetas.filter((m) => !newIds.has(m.id)).map((m) => m.id),
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

      // Load data for newly added charts
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
    [chartMetas],
  );

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

      setRenderGeneration((g) => g + 1);
      sendEmbedHeight();
    },
    [fetchChartData],
  );

  const loadAllCharts = useCallback(async () => {
    setCharts((prev) =>
      prev.map((c) => ({ ...c, isLoading: true, error: null })),
    );

    let loadedCount = 0;
    const currentMetas = chartMetas;
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

    setRenderGeneration((g) => g + 1);
    console.log(
      `[EMBED][STEP 10] Chart data fetched — ${loadedCount} charts loaded successfully`,
    );
    console.log(
      `[EMBED][STEP 11] Dashboard fully rendered in embed — ${loadedCount} charts visible`,
    );
    sendEmbedHeight();
  }, [chartMetas, fetchChartData]);

  useEffect(() => {
    void loadAllCharts();
  }, [loadAllCharts]);

  // Refresh cycle (data + dynamic discovery)

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
            reconcileCharts(meta.charts);
          }
          // Step 2: Reload data for all current charts
          void loadAllCharts();
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
  }, [loadAllCharts, fetchDashboardMeta, reconcileCharts, dashboardTitle]);

  // Render

  return (
    <>
      <div className="embed-header">
        <h1 id="dashboard-title">{dashboardTitle}</h1>
        <div className="subtitle">Powered by VizAI</div>
      </div>

      <div className="charts-grid" id="charts-grid">
        {charts.map((chart, index) => {
          const display = buildEmbedChartDisplayConfig(
            chart.rows,
            chart.type,
            chart.xAxis,
            chart.yAxis,
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
                  <ChartCard
                    key={`${chart.meta.id}-${renderGeneration}`}
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
                ) : (
                  <div className="error-state">No data available</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="powered-by">
        Embedded Dashboard · VizAI Analytics
      </div>
    </>
  );
}
