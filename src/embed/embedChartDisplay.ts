import type { ChartAxisConfig, ChartType } from "../components/features/charts/core/chartTypes";
import {
  extendedToChartDataConfig,
  getDefaultChartDataConfig,
  inferChartDataConfig,
  inferExtendedChartConfig,
  isExtendedChartType,
} from "../utils/chartData";

export interface EmbedChartDisplayConfig {
  data: Record<string, unknown>[];
  dataKeys: string[];
  xAxisKey: string;
  axisConfig?: ChartAxisConfig;
  effectiveType: ChartType;
}

export function buildEmbedChartDisplayConfig(
  rows: Record<string, unknown>[] | null | undefined,
  chartType: ChartType,
  xAxis?: string | null,
  yAxis?: string | null,
): EmbedChartDisplayConfig {
  if (!rows || rows.length === 0) {
    const defaults = getDefaultChartDataConfig();
    return {
      data: defaults.data,
      dataKeys: [defaults.dataKeys.primary],
      xAxisKey: defaults.xAxisKey,
      effectiveType: chartType,
    };
  }

  if (isExtendedChartType(chartType)) {
    const ext = inferExtendedChartConfig(rows, chartType, {
      xAxisKey: xAxis ?? undefined,
      yAxisKey: yAxis ?? undefined,
    });
    const config = extendedToChartDataConfig(ext);
    return {
      data: config.data,
      dataKeys: config.dataKeys,
      xAxisKey: config.xAxisKey,
      axisConfig: ext.axisConfig,
      effectiveType: ext.fallbackType ?? chartType,
    };
  }

  const inferred = inferChartDataConfig(rows, chartType as Parameters<typeof inferChartDataConfig>[1], {
    xAxisHint: xAxis ?? null,
    yAxisHint: yAxis ?? null,
  });

  return {
    data: inferred.data,
    dataKeys: [
      inferred.dataKeys.primary,
      ...(inferred.dataKeys.secondary ? [inferred.dataKeys.secondary] : []),
      ...(inferred.dataKeys.extraKeys ?? []),
    ],
    xAxisKey: xAxis || inferred.xAxisKey,
    effectiveType: chartType,
  };
}
