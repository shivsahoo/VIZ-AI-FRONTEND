import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { resolveColor } from "../core/colorResolver";
import { withBaseOption } from "../core/baseOption";

export function buildFunnelOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig, config, colors } = props;
  const labelKey = axisConfig?.xAxisKey ?? props.xAxisKey;
  const valueKey = axisConfig?.valueKey ?? props.dataKeys[0];

  const sorted = [...data].sort(
    (a, b) => Number(b[valueKey]) - Number(a[valueKey]),
  );

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
      orient: "horizontal",
      bottom: 0,
      textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
    },
    series: [
      {
        type: "funnel",
        left: "10%",
        width: "80%",
        top: 20,
        bottom: 40,
        sort: "descending",
        gap: 4,
        label: {
          show: true,
          position: "inside",
          color: "#fff",
          fontSize: 12,
          formatter: "{b}: {c}",
        },
        data: sorted.map((d, i) => ({
          name: String(d[labelKey]),
          value: Number(d[valueKey]) ?? 0,
          itemStyle: {
            color: resolveColor(config, String(i), i, colors),
          },
        })),
      },
    ],
  });
}
