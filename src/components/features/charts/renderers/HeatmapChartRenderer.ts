import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { buildGrid } from "../core/axisDefaults";
import { withBaseOption } from "../core/baseOption";

export function buildHeatmapOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig, compact = false, title } = props;
  const xKey = axisConfig?.xAxisKey ?? props.xAxisKey;
  const valKey = axisConfig?.valueKey ?? props.dataKeys[0];
  const sample = data[0] ?? {};
  const cols = Object.keys(sample);
  const yKey =
    axisConfig?.categoryKey ??
    cols.find((c) => c !== xKey && c !== valKey) ??
    cols[1] ??
    xKey;

  const xCategories = [...new Set(data.map((d) => String(d[xKey])))];
  const yCategories = [...new Set(data.map((d) => String(d[yKey])))];

  const heatData = data.map((d) => [
    xCategories.indexOf(String(d[xKey])),
    yCategories.indexOf(String(d[yKey])),
    Number(d[valKey]) ?? 0,
  ]);

  const values = heatData.map((d) => d[2] as number);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  const grid = {
    ...buildGrid(compact, Boolean(title)),
    bottom: compact ? 24 : 100,
  };

  return withBaseOption({
    grid,
    xAxis: {
      type: "category",
      data: xCategories,
      axisLabel: {
        rotate: 35,
        fontSize: 11,
        color: "rgba(255,255,255,0.65)",
        interval: 0,
        overflow: "truncate",
        width: 80,
      },
      splitArea: { show: true },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: yCategories,
      axisLabel: { fontSize: 11, color: "rgba(255,255,255,0.65)" },
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: {
      min: minVal,
      max: maxVal,
      calculable: true,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
      inRange: { color: ["#1a1a2e", "#4a3f8f", "#7c6af7"] },
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(20,20,30,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (p: { value?: number[] }) => {
        const v = p.value;
        if (!v || v.length < 3) return "";
        return `<div style="font-size:12px">
          <b>${xKey}:</b> ${xCategories[v[0] ?? 0]}<br/>
          <b>${yKey}:</b> ${yCategories[v[1] ?? 0]}<br/>
          <b>${valKey}:</b> ${Number(v[2]).toLocaleString()}
        </div>`;
      },
    },
    series: [
      {
        type: "heatmap",
        data: heatData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: "rgba(0,0,0,0.5)" },
        },
      },
    ],
  });
}
