import type { ChartConfig } from "./chartTypes";
import { DEFAULT_SERIES_COLORS } from "./constants";

const DEFAULT_PALETTE = [
  "#7c6af7",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

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
