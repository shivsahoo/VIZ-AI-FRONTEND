/**
 * Shared chart types (no ECharts imports).
 */

export type ChartType =
  | "line"
  | "bar"
  | "area"
  | "pie"
  | "donut"
  | "scatter"
  | "heatmap"
  | "funnel"
  | "map"
  | "stackedlinechart"
  | "stackedhorizontalbar"
  | "clustering"
  | "multiyaxischart";

export interface ChartConfig {
  [key: string]: {
    label?: string;
    color?: string;
  };
}

/** Extended axis config mirroring backend / API schema. */
export interface ChartAxisConfig {
  xAxisKey?: string;
  yAxisKey?: string;
  valueKey?: string;
  categoryKey?: string;
  regionKey?: string;
  metricKey?: string;
}

export interface ChartRendererProps {
  data: Record<string, any>[];
  dataKeys: string[];
  xAxisKey: string;
  config?: ChartConfig;
  extraFields?: string[];
  height?: number;
  axisConfig?: ChartAxisConfig;
}

/** Full props for ECharts option building (matches ChartCard’s public API). */
export interface ChartOptionBuildProps extends ChartRendererProps {
  type: ChartType;
  title?: string;
  compact?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  colors?: string[];
  strokeWidth?: number;
  /** Whether the UI is currently in dark mode. Used to set axis/label colors. */
  isDark?: boolean;
}

/** @alias Stable public name used by `ChartCard` consumers. */
export type ChartCardProps = ChartOptionBuildProps;
