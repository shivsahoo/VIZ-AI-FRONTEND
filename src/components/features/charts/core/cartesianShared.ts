import type { EChartsOption } from "echarts";

import {
  formatExtraFieldsBlock,
  formatTooltipValue,
} from "../ChartTooltip";
import { buildGrid, buildXAxis, buildYAxis } from "./axisDefaults";
import { buildEChartsTheme, resolveColor } from "./colorResolver";
import { DEFAULT_SERIES_COLORS } from "./constants";
import type { ChartOptionBuildProps } from "./chartTypes";
import { buildAxisTooltipShell } from "./tooltipDefaults";
import { isDateStringSample } from "./pieHelpers";

export type CartesianKind = "line" | "bar" | "area";

/** Cartesian ECharts option (line / bar / area), after keys are resolved. */
export function composeCartesianOption(
  props: ChartOptionBuildProps,
  xKey: string,
  seriesKeys: string[],
  cartesianType: CartesianKind,
): EChartsOption {
  const {
    data,
    config,
    colors = DEFAULT_SERIES_COLORS,
    extraFields,
    compact = false,
    showLegend,
    showGrid = true,
    strokeWidth = 2,
  } = props;

  const sample = data[0];
  const xIsDate = sample && isDateStringSample(sample[xKey]);
  const categories = data.map((row) => row[xKey]);
  const showPointSymbols = !compact && categories.length <= 12;

  let yMax = 0;
  let hasPositive = false;
  if (cartesianType === "bar") {
    for (const row of data) {
      for (const k of seriesKeys) {
        const n =
          typeof row[k] === "number" ? row[k] : Number(row[k]);
        if (!isNaN(n)) {
          if (n > yMax) yMax = n;
          if (n > 0) hasPositive = true;
        }
      }
    }
  }

  const yMinMax: [number, number] | undefined =
    cartesianType === "bar"
      ? !hasPositive && yMax === 0
        ? [0, 2]
        : [0, Math.max(10, Math.ceil(yMax * 1.1))]
      : undefined;

  const legendVisible =
    showLegend !== undefined ? showLegend : seriesKeys.length > 1;

  const formatAxisCategoryLabel = (val: string | number): string => {
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

  const themeColorList = buildEChartsTheme(config ?? {}).color;
  const pickColor = (i: number, key: string) =>
    resolveColor(config, key, i, colors, themeColorList);

  const grid = buildGrid(compact, Boolean(props.title));
  const xAxis = buildXAxis(
    compact,
    categories as (string | number)[],
    cartesianType,
    formatAxisCategoryLabel,
  );
  const yAxis = buildYAxis(compact, showGrid, yMinMax);

  const seriesList: EChartsOption["series"] =
    cartesianType === "bar"
      ? seriesKeys.map((key, index) => ({
          name: config?.[key]?.label ?? key,
          type: "bar" as const,
          data: data.map((d) => Number(d[key] ?? 0)),
          barMaxWidth: 48,
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
            color: pickColor(index, key),
          },
        }))
      : seriesKeys.map((key, index) => ({
          name: config?.[key]?.label ?? key,
          type: "line" as const,
          data: data.map((d) =>
            d[key] === null || d[key] === undefined
              ? null
              : Number(d[key]),
          ),
          smooth: false,
          showSymbol: showPointSymbols,
          symbolSize: showPointSymbols ? 6 : 0,
          connectNulls: true,
          lineStyle: {
            width: strokeWidth,
            type: index > 0 ? ("dashed" as const) : "solid",
          },
          areaStyle:
            cartesianType === "area"
              ? { opacity: 0.24 }
              : undefined,
          itemStyle: { color: pickColor(index, key) },
          emphasis: {
            focus: "series" as const,
          },
        }));

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
    const label =
      list[0]?.axisValueLabel ?? list[0]?.axisValue ?? "";
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

  const opt: EChartsOption = {
    animation: compact ? false : true,
    backgroundColor: "transparent",
    textStyle: {
      fontFamily: "inherit",
    },
    title: compact
      ? undefined
      : props.title
        ? {
            text: props.title,
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
    grid,
    xAxis,
    yAxis,
    series: seriesList,
  };

  return opt;
}
