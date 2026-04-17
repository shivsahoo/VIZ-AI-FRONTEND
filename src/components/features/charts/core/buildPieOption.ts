import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "./chartTypes";
import { PIE_SEGMENT_COLORS } from "./constants";
import { resolvePieNameKey } from "./pieHelpers";
import { formatPieTooltip } from "./pieTooltip";

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
  } = props;

  const sample = data[0];
  const valueKey = seriesKeys[0] ?? "value";
  const nameKey = sample
    ? resolvePieNameKey(sample, xKey, valueKey)
    : "name";

  const pieData = data.map((row, i) => ({
    name: String(row[nameKey] ?? row[xKey] ?? `Slice ${i + 1}`),
    value: Number(row[valueKey]) || 0,
    itemStyle: {
      color:
        config?.[String(row[nameKey] ?? row[xKey])]?.color ??
        PIE_SEGMENT_COLORS[i % PIE_SEGMENT_COLORS.length],
    },
  }));

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
              data,
              valueKey,
              extraFields,
            ),
        },
    legend: compact
      ? { show: false }
      : {
          show: legendVisible,
          left: 12,
          right: 12,
          bottom: 0,
          textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
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
          borderColor: "#111827",
          borderWidth: 2,
        },
        label: compact
          ? { show: false }
          : {
              show: true,
              position: "outside",
              color: "rgba(255,255,255,0.72)",
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
