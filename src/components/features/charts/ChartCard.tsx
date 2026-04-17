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

  const rendererProps: ChartCardProps = { ...props, axisConfig };

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

  if (
    type === "pie" ||
    type === "donut" ||
    type === "map" ||
    type === "scatter" ||
    type === "clustering" ||
    type === "heatmap" ||
    type === "funnel" ||
    type === "stackedhorizontalbar"
  ) {
    if (type === "heatmap") {
      const xCount = extractCategoryCount(option.xAxis);
      const yCount = extractCategoryCount(option.yAxis);
      const needsHorizontalScroll = xCount > 14;
      const needsVerticalScroll = yCount > 9;
      const minWidth = Math.max(560, xCount * 48);
      const renderHeight = needsVerticalScroll
        ? heatmapRenderHeight
        : baseHeight;
      return (
        <div
          className={`scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent w-full ${needsHorizontalScroll ? "overflow-x-auto" : "overflow-x-hidden"} ${needsVerticalScroll ? "overflow-y-auto" : "overflow-y-hidden"}`}
          style={{ height: baseHeight, minHeight: baseHeight }}
        >
          <div style={{ minWidth: needsHorizontalScroll ? minWidth : "100%", minHeight: renderHeight }}>
            {wrapped}
          </div>
        </div>
      );
    }

    if (type === "stackedhorizontalbar") {
      const needsVerticalScroll = stackedHorizontalDesiredHeight > baseHeight;
      const needsHorizontalScroll = data.length > 10;
      const horizontalMinWidth = Math.max(720, Math.round(baseHeight * 1.6));
      return (
        <div
          className={`scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent w-full ${needsHorizontalScroll ? "overflow-x-auto" : "overflow-x-hidden"} ${needsVerticalScroll ? "overflow-y-auto" : "overflow-y-hidden"}`}
          style={{ height: baseHeight, minHeight: baseHeight }}
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
      );
    }
    return (
      <div className="w-full" style={{ minHeight: effectiveHeight }}>
        {wrapped}
      </div>
    );
  }

  const pointCount = data.length;
  const minW = Math.max(400, pointCount * (type === "bar" ? 80 : 60));

  return (
    <div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent w-full overflow-x-auto">
      <div style={{ minWidth: minW, height: baseHeight }}>{wrapped}</div>
    </div>
  );
}
