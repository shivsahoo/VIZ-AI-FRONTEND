/**
 * Chart orchestration: delegates option building to per-type modules and renders ECharts.
 */
import * as React from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";

import { ChartContainer } from "../../ui/chart";
import type { ChartCardProps, ChartType } from "./core/chartTypes";
import { buildChartOption, resolveSeriesKeys } from "./core/buildChartOption";
import { ensureWorldMapRegistered } from "./core/mapRegister";
import { buildBarOption } from "./renderers/BarChartRenderer";
import { buildLineOption } from "./renderers/LineChartRenderer";
import { buildAreaOption } from "./renderers/AreaChartRenderer";
import { buildPieOption } from "./renderers/PieChartRenderer";
import { buildScatterOption } from "./renderers/ScatterChartRenderer";
import { buildHeatmapOption } from "./renderers/HeatmapChartRenderer";
import { buildFunnelOption } from "./renderers/FunnelChartRenderer";
import { buildMapOption } from "./renderers/MapChartRenderer";
import { buildStackedLineChartOption } from "./renderers/StackedLineChart";
import { buildStackedHorizontalBarOption } from "./renderers/StackedHorizontalBarChart";
import { buildClusteringOption } from "./renderers/ClusteringChartRenderer";
import { buildMultiYAxisOption } from "./renderers/MultiYAxisChartRenderer";

export type { ChartCardProps };
export type BuildChartOptionProps = ChartCardProps;
export { buildChartOption, resolveSeriesKeys };

const OPTION_BUILDERS: Record<
  ChartType,
  (p: ChartCardProps) => EChartsOption
> = {
  bar: buildBarOption,
  line: buildLineOption,
  area: buildAreaOption,
  pie: buildPieOption,
  donut: buildPieOption,
  scatter: buildScatterOption,
  heatmap: buildHeatmapOption,
  funnel: buildFunnelOption,
  map: buildMapOption,
  stackedlinechart: buildStackedLineChartOption,
  stackedhorizontalbar: buildStackedHorizontalBarOption,
  clustering: buildClusteringOption,
  multiyaxischart: buildMultiYAxisOption,
};

function hasRenderableSeries(option: EChartsOption): boolean {
  const rawSeries = option?.series;
  if (!rawSeries) return false;
  const seriesList = Array.isArray(rawSeries) ? rawSeries : [rawSeries];
  if (seriesList.length === 0) return false;

  return seriesList.some((series) => {
    if (!series || typeof series !== "object") return false;
    const data = (series as { data?: unknown }).data;
    if (!Array.isArray(data)) return true;
    return data.length > 0;
  });
}

function extractCategoryCount(axis: EChartsOption["xAxis"] | EChartsOption["yAxis"]): number {
  const target = Array.isArray(axis) ? axis[0] : axis;
  if (!target || typeof target !== "object") return 0;
  const data = (target as { data?: unknown }).data;
  return Array.isArray(data) ? data.length : 0;
}

export function ChartCard(props: ChartCardProps) {
  const {
    data,
    height,
    compact = false,
    config,
    type,
    axisConfig,
  } = props;
  const baseHeight = height ?? 300;

  // Detect dark mode by watching the `dark` class on <html>
  const [isDark, setIsDark] = React.useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const [mapReady, setMapReady] = React.useState(type !== "map");
  const [mapError, setMapError] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (type !== "map") {
      setMapReady(true);
      setMapError(undefined);
      return;
    }
    setMapReady(false);
    setMapError(undefined);
    let cancelled = false;
    ensureWorldMapRegistered()
      .then(() => {
        if (!cancelled) setMapReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setMapError(
            e instanceof Error ? e.message : "Could not load world map data.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type]);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  const sample = data[0];
  if (!sample || typeof sample !== "object") {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Invalid data format
      </div>
    );
  }

  const rendererProps: ChartCardProps = { ...props, axisConfig, isDark };

  const option = React.useMemo(
    () => {
      if (type === "map" && !mapReady) {
        return {};
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console -- temporary scatter pipeline debug
        console.log("[ChartCard] rendering", {
          type,
          xAxisKey: props.xAxisKey,
          dataKeys: props.dataKeys,
          axisConfig,
          rowCount: data?.length,
        });
      }
      return OPTION_BUILDERS[type](rendererProps);
    },
    [
      type,
      mapReady,
      isDark,
      props.data,
      props.dataKeys,
      props.xAxisKey,
      props.axisConfig,
      props.title,
      props.height,
      props.config,
      props.extraFields,
      props.compact,
      props.showLegend,
      props.showGrid,
      props.colors,
      props.strokeWidth,
    ],
  );

  if (type === "map" && mapError) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
        {mapError}
      </div>
    );
  }

  if (type === "map" && !mapReady) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center text-sm text-muted-foreground">
        Loading map…
      </div>
    );
  }

  if (!option || !Object.keys(option).length || !hasRenderableSeries(option)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data to display
      </div>
    );
  }

  const stackedHorizontalDesiredHeight = Math.min(1200, 40 * data.length + 140);
  const heatmapDesiredHeight =
    type === "heatmap"
      ? Math.min(900, Math.max(baseHeight - 24, Math.ceil(data.length / 12) * 24 + 96))
      : baseHeight;
  const effectiveHeight =
    type === "stackedhorizontalbar"
      ? (height !== undefined ? baseHeight : Math.max(baseHeight, stackedHorizontalDesiredHeight))
      : type === "heatmap"
        ? (height !== undefined ? baseHeight : heatmapDesiredHeight)
      : baseHeight;
  const stackedHorizontalRenderHeight =
    type === "stackedhorizontalbar"
      ? (height !== undefined ? Math.max(baseHeight, stackedHorizontalDesiredHeight) : effectiveHeight)
      : effectiveHeight;
  const heatmapRenderHeight =
    type === "heatmap"
      ? (height !== undefined ? heatmapDesiredHeight : effectiveHeight)
      : effectiveHeight;
  const chartRenderHeight =
    type === "stackedhorizontalbar"
      ? stackedHorizontalRenderHeight
      : type === "heatmap"
        ? heatmapRenderHeight
        : effectiveHeight;

  const chart = (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: chartRenderHeight }}
      opts={{ renderer: type === "heatmap" ? "canvas" : "svg" }}
      notMerge
      lazyUpdate
    />
  );

  const wrapped =
    config && Object.keys(config).length > 0 ? (
      <ChartContainer config={config} className="h-full w-full min-h-0">
        {chart}
      </ChartContainer>
    ) : (
      <div className="h-full w-full min-h-0">{chart}</div>
    );

  if (compact) {
    return (
      <div className="h-full w-full overflow-hidden">{wrapped}</div>
    );
  }

  const scrollXBar =
    "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent";

  /** Below this content width we skip overflow-x wrappers (fewer scrollbar bugs on Win/Chrome). */
  const CARTESIAN_PAN_WIDTH_PX = 648;

  const horizontalPanLayerStyle = {
    height: baseHeight,
    maxHeight: baseHeight,
    overflowX: "auto" as const,
    overflowY: "hidden" as const,
    minHeight: 0,
  };

  // ── Heatmap ──────────────────────────────────────────────────────────────
  if (type === "heatmap") {
    const xCount = extractCategoryCount(option.xAxis);
    const needsHorizontalScroll = xCount > 14;
    const minWidth = Math.max(560, xCount * 48);
    return (
      <div className="w-full overflow-hidden" style={{ height: baseHeight, minHeight: baseHeight }}>
        <div
          className={
            needsHorizontalScroll
              ? `${scrollXBar} w-full shrink-0 min-h-0`
              : "h-full max-h-full overflow-hidden min-h-0"
          }
          style={needsHorizontalScroll ? horizontalPanLayerStyle : undefined}
        >
          <div style={{ minWidth: needsHorizontalScroll ? minWidth : "100%", minHeight: heatmapRenderHeight }}>
            {wrapped}
          </div>
        </div>
      </div>
    );
  }

  // ── Stacked Horizontal Bar ────────────────────────────────────────────────
  if (type === "stackedhorizontalbar") {
    const needsHorizontalScroll = data.length > 10;
    const horizontalMinWidth = Math.max(720, Math.round(baseHeight * 1.6));
    return (
      <div className="w-full overflow-hidden" style={{ height: baseHeight, minHeight: baseHeight }}>
        <div
          className={
            needsHorizontalScroll
              ? `${scrollXBar} w-full shrink-0 min-h-0`
              : "h-full max-h-full overflow-hidden min-h-0"
          }
          style={needsHorizontalScroll ? horizontalPanLayerStyle : undefined}
        >
          <div
            style={{
              minHeight: stackedHorizontalRenderHeight,
              minWidth: needsHorizontalScroll ? horizontalMinWidth : "100%",
            }}
          >
            {wrapped}
          </div>
        </div>
      </div>
    );
  }

  // ── Pie / Donut — clip within card height (no vertical scroll) ────────────
  if (type === "pie" || type === "donut") {
    return (
      <div
        className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent w-full overflow-x-hidden overflow-y-hidden"
        style={{ height: baseHeight, minHeight: baseHeight }}
      >
        <div style={{ height: baseHeight, width: "100%" }}>{wrapped}</div>
      </div>
    );
  }

  // ── Scatter / Clustering — horizontal scroll for large datasets ───────────
  if (type === "scatter" || type === "clustering") {
    const needsHorizontal = data.length > 200;
    const minW = needsHorizontal ? Math.max(baseHeight * 1.5, 600) : undefined;
    return (
      <div className="w-full overflow-hidden" style={{ height: baseHeight, minHeight: baseHeight }}>
        <div
          className={
            needsHorizontal
              ? `${scrollXBar} w-full shrink-0 min-h-0`
              : "h-full max-h-full overflow-hidden min-h-0"
          }
          style={needsHorizontal ? horizontalPanLayerStyle : undefined}
        >
          <div
            style={{
              minWidth: minW ?? "100%",
              height: baseHeight,
              maxHeight: baseHeight,
            }}
          >
            {wrapped}
          </div>
        </div>
      </div>
    );
  }

  // ── Multi Y-Axis — horizontal scroll when many categories ────────────────
  if (type === "multiyaxischart") {
    const needsHorizontal = data.length > 15;
    const minW = needsHorizontal ? Math.max(600, data.length * 56) : undefined;
    return (
      <div className="w-full overflow-hidden" style={{ height: baseHeight, minHeight: baseHeight }}>
        <div
          className={
            needsHorizontal
              ? `${scrollXBar} w-full shrink-0 min-h-0`
              : "h-full max-h-full overflow-hidden min-h-0"
          }
          style={needsHorizontal ? horizontalPanLayerStyle : undefined}
        >
          <div
            style={{
              minWidth: minW ?? "100%",
              height: baseHeight,
              maxHeight: baseHeight,
            }}
          >
            {wrapped}
          </div>
        </div>
      </div>
    );
  }

  // ── Funnel — clip within card height (no vertical scroll) ─────────────────
  if (type === "funnel") {
    return (
      <div
        className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent w-full overflow-x-hidden overflow-y-hidden"
        style={{ height: baseHeight, minHeight: baseHeight }}
      >
        <div style={{ height: baseHeight, width: "100%" }}>{wrapped}</div>
      </div>
    );
  }

  // ── Map — fixed size, self-contained ─────────────────────────────────────
  if (type === "map") {
    return (
      <div className="w-full" style={{ minHeight: effectiveHeight }}>
        {wrapped}
      </div>
    );
  }

  // ── Line, Bar, Area, StackedLineChart — pan only when many points need extra width ──
  const pointCount = data.length;
  const pitch = type === "bar" ? 80 : 60;
  const minWDesired = Math.max(400, pointCount * pitch);
  const needsHorizontalPan = minWDesired > CARTESIAN_PAN_WIDTH_PX;

  if (!needsHorizontalPan) {
    return (
      <div className="w-full overflow-hidden" style={{ height: baseHeight, minHeight: baseHeight }}>
        <div style={{ height: baseHeight }} className="h-full overflow-hidden">
          {wrapped}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden" style={{ height: baseHeight, minHeight: baseHeight }}>
      <div className={`${scrollXBar} w-full shrink-0 min-h-0`} style={horizontalPanLayerStyle}>
        <div style={{ minWidth: minWDesired, height: baseHeight, maxHeight: baseHeight }}>
          {wrapped}
        </div>
      </div>
    </div>
  );
}
