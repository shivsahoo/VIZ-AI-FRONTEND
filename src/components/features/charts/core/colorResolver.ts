import type { ChartConfig } from "./chartTypes";
import { DEFAULT_SERIES_COLORS } from "./constants";

/** Theme-aware colors used for axes, labels, gridlines, and legends. */
export interface ChartAxisColors {
  /** Axis tick labels and legend text */
  labelColor: string;
  /** Subtle grid / split lines */
  splitLineColor: string;
  /** Axis border lines */
  axisLineColor: string;
  /** Series bar-segment labels (over colored bars) */
  barLabelColor: string;
}

/**
 * Returns the set of axis / label colors appropriate for the current theme.
 * All option builders should call this instead of hardcoding rgba(255,255,255,...) values.
 */
export function getChartAxisColors(isDark: boolean): ChartAxisColors {
  if (isDark) {
    return {
      labelColor: "#a1a1a6",
      splitLineColor: "rgba(255,255,255,0.07)",
      axisLineColor: "rgba(255,255,255,0.14)",
      barLabelColor: "rgba(255,255,255,0.92)",
    };
  }
  return {
    labelColor: "#6e6e73",
    splitLineColor: "rgba(0,0,0,0.06)",
    axisLineColor: "rgba(0,0,0,0.12)",
    barLabelColor: "#1d1d1f",
  };
}

const DEFAULT_PALETTE = DEFAULT_SERIES_COLORS;

/**
 * Series color for a keyed metric — matches previous ChartCard `pickColor` behavior.
 */
export function resolveColor(
  config: ChartConfig | undefined,
  key: string,
  index: number,
  colorsProp?: string[],
  themeColorList?: string[],
): string {
  const fromConfig = config?.[key]?.color;
  if (fromConfig) return fromConfig;

  const palette = colorsProp?.length ? colorsProp : DEFAULT_SERIES_COLORS;
  const fromProp = palette[index % palette.length];
  if (fromProp) return fromProp;

  if (themeColorList?.length) {
    return themeColorList[index % themeColorList.length]!;
  }

  return DEFAULT_PALETTE[index % DEFAULT_PALETTE.length]!;
}

/** Maps ChartConfig entry colors into an ECharts `color` array (same as legacy `chart.tsx`). */
export function buildEChartsTheme(config: ChartConfig): { color: string[] } {
  const colors = Object.values(config)
    .map((c) => c.color)
    .filter((c): c is string => Boolean(c));
  return { color: colors.length > 0 ? colors : [] };
}
