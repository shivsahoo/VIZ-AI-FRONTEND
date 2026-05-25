import { useCallback, useEffect, useRef, useState } from "react";

import { ChartCard } from "../components/features/charts/ChartCard";
import type { ChartType } from "../components/features/charts/core/chartTypes";
import { coerceChartType } from "../utils/chartSpecNormalizer";
import { buildEmbedChartDisplayConfig } from "./embedChartDisplay";
import type { EmbedChartMeta, EmbedChartState, EmbedTheme } from "./types";

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
}

export function EmbedApp({
  tokenId,
  apiBase,
  dashboardTitle,
  charts: chartMetas,
}: EmbedAppProps) {
  const [theme, setTheme] = useState<EmbedTheme>("dark");
  const [charts, setCharts] = useState<EmbedChartState[]>(() =>
    chartMetas.map((meta) => ({
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

  const fetchChartData = useCallback(
    async (chartId: string): Promise<{
      rows: Record<string, unknown>[] | null;
      error: string | null;
      xAxis?: string | null;
      yAxis?: string | null;
      chartType?: string;
    }> => {
      try {
        const response = await fetchWithTimeout(
          `${apiBase}/api/v1/embed/${tokenId}/data/${chartId}`,
          {
            headers: {
              Authorization: `Bearer ${tokenId}`,
              "Content-Type": "application/json",
            },
          },
          FETCH_TIMEOUT_MS,
        );

        if (response.status === 403) {
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
    },
    [apiBase, tokenId],
  );

  const loadAllCharts = useCallback(async () => {
    setCharts((prev) =>
      prev.map((c) => ({ ...c, isLoading: true, error: null })),
    );

    let loadedCount = 0;
    const results = await Promise.all(
      chartMetas.map(async (meta) => {
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

  useEffect(() => {
    const startRefreshCycle = () => {
      if (refreshTimerRef.current !== null) {
        window.clearInterval(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setInterval(() => {
        const visible = document.visibilityState === "visible";
        console.log(
          `[EMBED][STEP 14] Data refresh cycle — tab visible: ${visible}, next refresh in ${REFRESH_INTERVAL_MS / 1000}s`,
        );
        if (visible) {
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
  }, [loadAllCharts]);

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
                    height={280}
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
