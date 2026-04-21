import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { withBaseOption } from "../core/baseOption";
import { buildAxisTooltipShell } from "../core/tooltipDefaults";
import { DEFAULT_SERIES_COLORS } from "../core/constants";
import { getChartAxisColors } from "../core/colorResolver";

function isNumericValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
}

function toLabel(value: string): string {
  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatMetricValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function buildMultiYAxisOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig, compact = false, title, colors, isDark = true } = props;
  const { labelColor, splitLineColor, axisLineColor } = getChartAxisColors(isDark);
  if (!data.length || typeof data[0] !== "object") {
    return withBaseOption({ series: [] });
  }

  const columns = Object.keys(data[0]);
  const numericColumns = columns.filter((c) => data.some((r) => isNumericValue(r[c])));
  const xKey =
    (axisConfig?.xAxisKey && columns.includes(axisConfig.xAxisKey) ? axisConfig.xAxisKey : undefined) ??
    (props.xAxisKey && columns.includes(props.xAxisKey) ? props.xAxisKey : undefined) ??
    columns.find((c) => !numericColumns.includes(c)) ??
    columns[0];

  const metricKeys = numericColumns
    .filter((c) => c !== xKey)
    .slice(0, 3);

  if (!xKey || metricKeys.length < 2) {
    return withBaseOption({ series: [] });
  }

  const palette = colors?.length ? colors : DEFAULT_SERIES_COLORS;
  const categories = data.map((row, i) => String(row[xKey] ?? `Row ${i + 1}`));

  const yAxisDefs = metricKeys.map((key, index) => {
    const axisColor = palette[index % palette.length];
    const position = index === 2 ? "left" : "right";
    const offset = index === 1 ? 80 : 0;
    return {
      type: "value" as const,
      name: compact ? undefined : toLabel(key),
      position,
      alignTicks: true,
      offset,
      axisLine: {
        show: !compact,
        lineStyle: { color: axisColor },
      },
      axisTick: { show: false },
      splitLine:
        index === 2 && !compact
          ? { lineStyle: { color: splitLineColor } }
          : { show: false },
      axisLabel: compact
        ? { show: false }
        : {
            color: labelColor,
            fontSize: 11,
            formatter: (v: number | string) => formatMetricValue(Number(v)),
          },
      nameTextStyle: {
        color: axisColor,
        fontSize: 12,
      },
    };
  });

  const series = metricKeys.map((key, index) => {
    const color = palette[index % palette.length];
    const lineSeries = metricKeys.length >= 3 ? index === 2 : index === 1;
    return {
      name: toLabel(key),
      type: lineSeries ? ("line" as const) : ("bar" as const),
      yAxisIndex: index,
      data: data.map((row) => Number(row[key]) || 0),
      smooth: lineSeries,
      showSymbol: lineSeries,
      symbol: lineSeries ? "circle" : undefined,
      symbolSize: lineSeries ? 7 : undefined,
      lineStyle: lineSeries ? { width: 2 } : undefined,
      emphasis: { focus: "series" as const },
      itemStyle: { color },
    };
  });

  const tooltipFormatter = (params: unknown): string => {
    const list = Array.isArray(params)
      ? (params as Array<{ axisValueLabel?: string; seriesName?: string; value?: unknown; marker?: string }>)
      : [];
    if (!list.length) return "";
    const titleLabel = list[0]?.axisValueLabel ?? "";
    const rows = list
      .map((p) => {
        const value = Number(p.value);
        return `${p.marker ?? ""} ${p.seriesName ?? "Series"}: <b>${formatMetricValue(value)}</b>`;
      })
      .join("<br/>");
    return `<div style="font-size:12px"><b>${titleLabel}</b><br/>${rows}</div>`;
  };

  return withBaseOption({
    animation: compact ? false : true,
    title:
      compact || !title
        ? undefined
        : {
            text: title,
            left: "center",
            textStyle: { fontSize: 14, color: labelColor },
          },
    color: palette,
    tooltip: compact
      ? { show: false }
      : {
          ...buildAxisTooltipShell(tooltipFormatter, isDark),
          axisPointer: { type: "cross" },
        },
    legend: compact
      ? { show: false }
      : {
          show: true,
          left: 12,
          right: 12,
          bottom: 0,
          textStyle: { color: labelColor, fontSize: 11 },
          data: series.map((s) => s.name),
        },
    grid: compact
      ? { top: 0, bottom: 0, left: 0, right: 0, containLabel: false }
      : { top: title ? 56 : 24, left: 72, right: 180, bottom: 92, containLabel: true },
    xAxis: {
      type: "category",
      data: categories,
      axisTick: { alignWithLabel: true },
      axisLabel: compact
        ? { show: false }
        : {
            color: labelColor,
            fontSize: 11,
            hideOverlap: true,
            interval: 0,
            rotate: categories.length > 8 ? 26 : 0,
          },
      axisLine: { lineStyle: { color: axisLineColor } },
    },
    yAxis: yAxisDefs,
    series,
  });
}
