import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { resolveColor } from "../core/colorResolver";
import { withBaseOption } from "../core/baseOption";

const MAX_VISIBLE_FUNNEL_STAGES = 7;

export function buildFunnelOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig, config, colors, compact = false } = props;
  const labelKey = axisConfig?.xAxisKey ?? props.xAxisKey;
  const valueKey = axisConfig?.valueKey ?? props.dataKeys[0];

  const sorted = [...data]
    .map((row) => ({
      label: String(row[labelKey] ?? ""),
      value: Number(row[valueKey]),
    }))
    .filter((row) => row.label && Number.isFinite(row.value) && row.value >= 0)
    .sort((a, b) => b.value - a.value);

  const funnelRows =
    sorted.length > MAX_VISIBLE_FUNNEL_STAGES
      ? [
          ...sorted.slice(0, MAX_VISIBLE_FUNNEL_STAGES - 1),
          {
            label: "Other",
            value: sorted
              .slice(MAX_VISIBLE_FUNNEL_STAGES - 1)
              .reduce((sum, row) => sum + row.value, 0),
          },
        ]
      : sorted;

  const useOutsideLabels = funnelRows.length > 5;

  return withBaseOption({
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(20,20,30,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (p: {
        name?: string;
        value?: number;
        percent?: number;
      }) => {
        const pct =
          p.percent != null && !Number.isNaN(p.percent)
            ? `${p.percent}%`
            : "";
        return `<div style="font-size:12px">
          <b>${p.name ?? ""}</b><br/>
          ${valueKey}: <b>${Number(p.value).toLocaleString()}</b>
          ${pct ? `(${pct})` : ""}
        </div>`;
      },
    },
    legend: {
      show: !compact && funnelRows.length > 1 && funnelRows.length <= 5,
      orient: "horizontal",
      left: 12,
      right: 12,
      bottom: 0,
      textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
    },
    series: [
      {
        type: "funnel",
        left: "10%",
        width: "80%",
        top: compact ? 8 : 24,
        bottom: compact ? 8 : useOutsideLabels ? 24 : 56,
        sort: "descending",
        gap: 4,
        label: {
          show: true,
          position: useOutsideLabels ? "right" : "inside",
          color: useOutsideLabels ? "rgba(255,255,255,0.72)" : "#fff",
          fontSize: 11,
          overflow: "truncate",
          width: useOutsideLabels ? 140 : 160,
          formatter: (param: { name?: string; value?: number }) =>
            useOutsideLabels
              ? `${param.name ?? ""}`
              : `${param.name ?? ""}: ${Number(param.value ?? 0).toLocaleString()}`,
        },
        labelLine: {
          show: useOutsideLabels,
          length: 10,
          length2: 8,
        },
        minSize: "10%",
        maxSize: "100%",
        data: funnelRows.map((d, i) => ({
          name: d.label,
          value: d.value,
          itemStyle: {
            color: resolveColor(config, d.label, i, colors),
          },
        })),
      },
    ],
  });
}
