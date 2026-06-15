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

const FALLBACK_CONFIG: EmbedChartDisplayConfig = {
  data: [],
  dataKeys: ["value"],
  xAxisKey: "label",
  effectiveType: "bar",
};

export function buildEmbedChartDisplayConfig(
  rows: Record<string, unknown>[] | null | undefined,
  chartType: ChartType,
  xAxis?: string | null,
  yAxis?: string | null,
): EmbedChartDisplayConfig {
  try {
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
        dataKeys: config.dataKeys
          ? [
              config.dataKeys.primary,
              ...(config.dataKeys.secondary ? [config.dataKeys.secondary] : []),
              ...(config.extraKeys ?? []),
            ]
          : ["value"],
        xAxisKey: config.xAxisKey || "label",
        axisConfig: ext.axisConfig,
        effectiveType: ext.fallbackType ?? chartType,
      };
    }

    const inferred = inferChartDataConfig(rows, chartType as Parameters<typeof inferChartDataConfig>[1], {
      xAxisHint: xAxis ?? null,
      yAxisHint: yAxis ?? null,
    });


    const primaryKey = inferred.dataKeys?.primary;
    if (!primaryKey) {
      console.warn("[embedChartDisplay] inferChartDataConfig returned no primary key", { chartType, xAxis, yAxis });
      return { ...FALLBACK_CONFIG, data: rows, effectiveType: chartType };
    }

    return {
      data: inferred.data,
      dataKeys: [
        primaryKey,
        ...(inferred.dataKeys.secondary ? [inferred.dataKeys.secondary] : []),
        ...(inferred.extraKeys ?? []),
      ],
      xAxisKey: (xAxis && inferred.data[0] && xAxis in inferred.data[0]) ? xAxis : (inferred.xAxisKey || "label"),
      effectiveType: chartType,
    };
  } catch (err) {
    console.error("[embedChartDisplay] buildEmbedChartDisplayConfig threw:", err);
    return { ...FALLBACK_CONFIG, effectiveType: chartType };
  }
}
