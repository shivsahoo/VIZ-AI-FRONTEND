import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { resolveSeriesKeys } from "../core/buildChartOption";
import { buildGrid } from "../core/axisDefaults";
import { buildEChartsTheme, resolveColor } from "../core/colorResolver";
import { DEFAULT_SERIES_COLORS } from "../core/constants";
import { buildAxisTooltipShell } from "../core/tooltipDefaults";
import { isDateStringSample } from "../core/pieHelpers";
import {
  formatExtraFieldsBlock,
  formatTooltipValue,
} from "../ChartTooltip";

const STACK_ID = "total";

/**
 * Builds a stacked horizontal bar chart (value on x, category on y), matching
 * Apache ECharts `xAxis.type: 'value'`, `yAxis.type: 'category'`, `series[].stack`.
 */
export function buildStackedHorizontalBarOption(
  props: ChartOptionBuildProps,
): EChartsOption {
  const {
    data,
    config,
    colors = DEFAULT_SERIES_COLORS,
    extraFields,
    compact = false,
    showLegend,
    showGrid = true,
    title,
  } = props;

  let xKey = props.xAxisKey;
  const sample = data[0];
  if (sample && xKey && !(xKey in sample)) {
    const fallback = Object.keys(sample).find(
      (k) => typeof sample[k] !== "number",
    );
    xKey = fallback ?? xKey;
  }

  const seriesKeys = resolveSeriesKeys(
    data,
    xKey ?? "",
    props.dataKeys ?? [],
  );
  if (!data?.length || !xKey || seriesKeys.length === 0) {
    return {};
  }

  const xIsDate = sample && isDateStringSample(sample[xKey]);

  const formatCategoryLabel = (val: string | number): string => {
    if (xIsDate) {
      try {
        const d = new Date(val as string);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        }
      } catch {
        /* fall through */
      }
    }
    return String(val);
  };

  const categories = data.map((row) =>
    formatCategoryLabel(row[xKey] as string | number),
  );
  const isDenseCategoryView = categories.length > 10;

  let maxTotal = 0;
  for (const row of data) {
    let t = 0;
    for (const k of seriesKeys) {
      const n = Number(row[k] ?? 0);
      if (!Number.isNaN(n)) t += n;
    }
    if (t > maxTotal) maxTotal = t;
  }
  const xMax = maxTotal <= 0 ? 10 : Math.ceil(maxTotal * 1.1);

  const themeColorList = buildEChartsTheme(config ?? {}).color;
  const pickColor = (i: number, key: string) =>
    resolveColor(config, key, i, colors, themeColorList);

  const legendVisible =
    showLegend !== undefined ? showLegend : seriesKeys.length > 1;

  const axisTooltipFormatter = (params: unknown): string => {
    const list = (Array.isArray(params) ? params : [params]) as Array<{
      axisValue?: unknown;
      axisValueLabel?: unknown;
      dataIndex?: number;
      seriesName?: string;
      value?: unknown;
      color?: string;
    }>;
    if (!list.length) return "";
    const label = list[0]?.axisValueLabel ?? list[0]?.axisValue ?? "";
    const dataIndex =
      typeof list[0]?.dataIndex === "number" ? list[0].dataIndex : 0;
    const row = data[dataIndex] as Record<string, unknown> | undefined;
    const rows = list
      .map((p) => {
        const num = Number(p.value);
        const valText = Number.isFinite(num)
          ? num.toLocaleString()
          : formatTooltipValue(
              p.value as number | string,
              String(p.seriesName ?? ""),
              row,
            );
        return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color ?? "#ccc"};margin-right:6px;"></span>${p.seriesName ?? ""}: <b>${valText}</b>`;
      })
      .join("<br/>");
    let html = `<div style="font-size:12px"><b>${String(label)}</b><br/>${rows}</div>`;
    html += formatExtraFieldsBlock(row, new Set(seriesKeys), extraFields);
    return html;
  };

  const valueXAxis: EChartsOption["xAxis"] = compact
    ? { type: "value", show: false }
    : {
        type: "value",
        min: 0,
        max: xMax,
        splitNumber: 4,
        splitLine: showGrid
          ? { lineStyle: { color: "rgba(255,255,255,0.08)" } }
          : { show: false },
        axisLabel: {
          fontSize: 11,
          color: "rgba(255,255,255,0.65)",
          margin: 8,
          hideOverlap: true,
          formatter: (value: number | string) => {
            const v = typeof value === "number" ? value : Number(value);
            if (Number.isNaN(v)) return String(value);
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
            if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
            return `${v}`;
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
      };

  const categoryYAxis: EChartsOption["yAxis"] = compact
    ? { type: "category", data: categories, show: false }
    : {
        type: "category",
        data: categories,
        axisLabel: {
          fontSize: 11,
          color: "rgba(255,255,255,0.65)",
          margin: 10,
          overflow: "truncate",
          width: 132,
        },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
        axisTick: { show: false },
      };

  const seriesList: EChartsOption["series"] = seriesKeys.map((key, index) => ({
    name: config?.[key]?.label ?? key,
    type: "bar" as const,
    stack: STACK_ID,
    emphasis: { focus: "series" as const },
    label: {
      show: !compact && !isDenseCategoryView,
      color: "rgba(255,255,255,0.92)",
      fontSize: 10,
      formatter: (p: { value?: number }) => {
        const v = Number(p.value);
        if (!Number.isFinite(v) || v === 0) return "";
        return v.toLocaleString();
      },
    },
    data: data.map((d) => Number(d[key] ?? 0)),
    barMaxWidth: 36,
    itemStyle: {
      color: pickColor(index, key),
    },
  }));

  return {
    animation: compact ? false : true,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "inherit" },
    title: compact
      ? undefined
      : title
        ? {
            text: title,
            left: 12,
            top: 8,
            textStyle: { fontSize: 14, fontFamily: "inherit" },
          }
        : undefined,
    tooltip: compact
      ? { show: false }
      : buildAxisTooltipShell(axisTooltipFormatter),
    legend: compact
      ? { show: false }
      : {
          show: legendVisible,
          bottom: 0,
          left: 12,
          right: 12,
          textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
          data: seriesKeys.map((k) => config?.[k]?.label ?? k),
        },
    grid: compact
      ? buildGrid(compact, Boolean(title))
      : {
          top: title ? 56 : 24,
          right: 28,
          bottom: 96,
          left: 96,
          containLabel: true,
        },
    xAxis: valueXAxis,
    yAxis: categoryYAxis,
    series: seriesList,
  };
}
