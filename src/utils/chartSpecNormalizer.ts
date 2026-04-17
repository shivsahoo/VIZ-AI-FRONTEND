import type { ChartAxisConfig, ChartType } from "../components/features/charts/core/chartTypes";

const KNOWN_TYPES: ChartType[] = [
  "line",
  "bar",
  "area",
  "pie",
  "donut",
  "scatter",
  "heatmap",
  "funnel",
  "map",
  "stackedlinechart",
];

export function coerceChartType(raw: string | undefined | null): ChartType {
  const s0 = (raw ?? "line").toLowerCase();
  const s = s0 === "stacked_line_chart" ? "stackedlinechart" : s0;
  return (KNOWN_TYPES.includes(s as ChartType) ? s : "line") as ChartType;
}

/**
 * Raw backend / WebSocket `chart_spec` (flat `x_axis` / `y_axis`).
 * `chart_type` is accepted as any string and coerced to `ChartType`.
 */
export interface RawChartSpec {
  title: string;
  query: string;
  chart_type: string;
  x_axis?: string | null;
  y_axis?: string | null;
  report?: string;
  relevance?: number;
  is_time_based?: boolean;
  data_connection_id: string;
  value_key?: string | null;
  category_key?: string | null;
  region_key?: string | null;
  metric_key?: string | null;
}

export interface NormalizedChartSpec {
  title: string;
  query: string;
  chartType: ChartType;
  xAxisKey: string;
  yAxisKey?: string;
  axisConfig: ChartAxisConfig;
  dataConnectionId: string;
  relevance?: number;
  isTimeBased?: boolean;
}

export function normalizeChartSpec(raw: RawChartSpec): NormalizedChartSpec {
  const chartType = coerceChartType(raw.chart_type);
  const axisConfig = buildAxisConfig({ ...raw, chart_type: chartType });

  const xAxisKey =
    axisConfig.xAxisKey ?? (raw.x_axis === null || raw.x_axis === undefined ? "" : raw.x_axis);
  const yAxisKey =
    axisConfig.yAxisKey ??
    (raw.y_axis === null || raw.y_axis === undefined ? undefined : raw.y_axis);

  return {
    title: raw.title,
    query: raw.query,
    chartType,
    xAxisKey,
    yAxisKey,
    axisConfig,
    dataConnectionId: raw.data_connection_id,
    relevance: raw.relevance,
    isTimeBased: raw.is_time_based,
  };
}

function buildAxisConfig(
  raw: Omit<RawChartSpec, "chart_type"> & { chart_type: ChartType },
): ChartAxisConfig {
  const x = raw.x_axis === null ? undefined : raw.x_axis ?? undefined;
  const y = raw.y_axis === null ? undefined : raw.y_axis ?? undefined;

  switch (raw.chart_type) {
    case "scatter":
      return {
        xAxisKey: x,
        yAxisKey: y,
      };

    case "heatmap":
      return {
        xAxisKey: x,
        categoryKey: raw.category_key ?? y,
        valueKey: raw.value_key ?? undefined,
      };

    case "funnel":
      return {
        xAxisKey: x,
        valueKey: raw.value_key ?? y,
      };

    case "map":
      return {
        regionKey: raw.region_key ?? x,
        metricKey: raw.metric_key ?? y,
      };

    case "pie":
    case "donut":
      return {
        xAxisKey: x,
        valueKey: y ?? raw.value_key ?? undefined,
      };

    case "line":
    case "bar":
    case "area":
    case "stackedlinechart":
      return {
        xAxisKey: x,
        yAxisKey: y,
      };

    default:
      return {
        xAxisKey: x,
      };
  }
}
