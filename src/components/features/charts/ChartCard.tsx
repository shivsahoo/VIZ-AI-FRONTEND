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
  scatter: buildScatterOption,
  heatmap: buildHeatmapOption,
  funnel: buildFunnelOption,
  map: buildMapOption,
};

export function ChartCard(props: ChartCardProps) {
  const {
    data,
    height = 300,
    compact = false,
    config,
    type,
    axisConfig,
  } = props;

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

  if (!option || !Object.keys(option).length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No series to display
      </div>
    );
  }

  const chart = (
    <ReactECharts
      option={option}
      style={{ width: "100%", height: height ?? 300 }}
      opts={{ renderer: "svg" }}
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
    type === "map" ||
    type === "scatter" ||
    type === "heatmap" ||
    type === "funnel"
  ) {
    return (
      <div className="w-full" style={{ minHeight: height }}>
        {wrapped}
      </div>
    );
  }

  const pointCount = data.length;
  const minW = Math.max(400, pointCount * (type === "bar" ? 80 : 60));

  return (
    <div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent w-full overflow-x-auto">
      <div style={{ minWidth: minW, height }}>{wrapped}</div>
    </div>
  );
}
