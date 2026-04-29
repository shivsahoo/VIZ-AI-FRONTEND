import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "./chartTypes";
import { PIE_SEGMENT_COLORS } from "./constants";
import { resolvePieNameKey } from "./pieHelpers";
import { formatPieTooltip } from "./pieTooltip";
import { getChartAxisColors } from "./colorResolver";

/** ECharts option for the pie series (invoked from `buildChartOption` after keys are resolved). */
export function composePieOption(
  props: ChartOptionBuildProps,
  xKey: string,
  seriesKeys: string[],
): EChartsOption {
  const {
    data,
    config,
    compact = false,
    showLegend,
    extraFields,
    isDark = true,
  } = props;
  const { labelColor } = getChartAxisColors(isDark);

  const sample = data[0];
  const valueKey = seriesKeys[0] ?? "value";
  const nameKey = sample
    ? resolvePieNameKey(sample, xKey, valueKey)
    : "name";

  type PieDatum = {
    name: string;
    value: number;
    itemStyle: { color: string };
    __row?: Record<string, any>;
    __isOther?: boolean;
    __otherBreakdown?: Array<{ name: string; value: number; percent: number }>;
  };

  const rawPieData: PieDatum[] = data.map((row, i) => ({
    name: String(row[nameKey] ?? row[xKey] ?? `Slice ${i + 1}`),
    value: Number(row[valueKey]) || 0,
    itemStyle: {
      color:
        config?.[String(row[nameKey] ?? row[xKey])]?.color ??
        PIE_SEGMENT_COLORS[i % PIE_SEGMENT_COLORS.length],
    },
    __row: row,
  }));

  // Long-tail: percent-only rules fail when dozens of cities each have a small
  // but non-trivial share — the chart turns into an unreadable wheel. When the
  // number of categories exceeds MAX_SLICES_SHOW_ALL, keep the top K by value
  // and merge the rest into "Other" (tooltip lists the breakdown).
  const MAX_SLICES_SHOW_ALL = 24;
  const TOP_K_WHEN_MANY_CATEGORIES = 18;
  const OTHER_SLICE_COLOR = "#60A5FA";
  const total = rawPieData.reduce((sum, d) => sum + d.value, 0);

  let pieData: PieDatum[] = rawPieData;
  if (rawPieData.length > MAX_SLICES_SHOW_ALL && total > 0) {
    const sorted = [...rawPieData].sort((a, b) => b.value - a.value);
    const top = sorted.slice(0, TOP_K_WHEN_MANY_CATEGORIES);
    const rest = sorted.slice(TOP_K_WHEN_MANY_CATEGORIES);
    if (rest.length >= 1) {
      const otherValue = rest.reduce((s, d) => s + d.value, 0);
      const breakdown = rest
        .map((d) => ({
          name: d.name,
          value: d.value,
          percent: (d.value / total) * 100,
        }))
        .sort((a, b) => b.value - a.value);
      const otherSlice: PieDatum = {
        name: `Other (${rest.length})`,
        value: otherValue,
        itemStyle: { color: OTHER_SLICE_COLOR },
        __isOther: true,
        __otherBreakdown: breakdown,
      };
      pieData = [...top, otherSlice];
    }
  }

  const legendVisible =
    showLegend !== undefined ? showLegend : pieData.length > 1;
  const isDonut = props.type === "donut";
  const titleOffset = props.title ? 36 : 16;

  const opt: EChartsOption = {
    animation: true,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "inherit" },
    title: compact
      ? undefined
      : props.title
        ? { text: props.title, left: "center", textStyle: { fontSize: 14 } }
        : undefined,
    tooltip: compact
      ? { show: false }
      : {
          trigger: "item",
          renderMode: "html",
          appendToBody: true,
          confine: false,
          backgroundColor: "transparent",
          borderWidth: 0,
          extraCssText: "max-width: 360px; white-space: normal; box-shadow: none; z-index: 9999;",
          formatter: (p: unknown) =>
            formatPieTooltip(
              p as Record<string, unknown>,
              valueKey,
              extraFields,
              isDark,
            ),
        },
    legend: compact
      ? { show: false }
      : {
          show: legendVisible,
          left: 12,
          right: 12,
          bottom: 0,
          textStyle: { color: labelColor, fontSize: 11 },
        },
    series: [
      {
        type: "pie",
        top: titleOffset,
        bottom: legendVisible && !compact ? 56 : 16,
        radius: isDonut ? ["44%", "68%"] : ["0%", "70%"],
        avoidLabelOverlap: true,
        minShowLabelAngle: 4,
        itemStyle: {
          borderRadius: isDonut ? 6 : 4,
          borderColor: isDark ? "#111827" : "#ffffff",
          borderWidth: 2,
        },
        label: compact
          ? { show: false }
          : {
              show: true,
              position: "outside",
              color: labelColor,
              fontSize: 11,
              formatter: "{b}",
            },
        labelLine: compact
          ? { show: false }
          : {
              show: true,
              length: 10,
              length2: 10,
              smooth: true,
            },
        labelLayout: { hideOverlap: true },
        data: pieData,
      },
    ],
  };

  return opt;
}
