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
          type: "scroll",
          bottom: 0,
        },
    series: [
      {
        type: "pie",
        radius: ["42%", "68%"],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 4, borderColor: "#fff", borderWidth: 1 },
        label: { show: !compact },
        data: pieData,
      },
    ],
  };

  return opt;
}
