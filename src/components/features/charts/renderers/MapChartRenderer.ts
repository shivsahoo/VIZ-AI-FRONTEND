import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { withBaseOption } from "../core/baseOption";

/**
 * Builds a choropleth on the registered `"world"` map.
 * Call `ensureWorldMapRegistered()` before rendering (handled in `ChartCard`).
 */
export function buildMapOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig } = props;
  const regionKey = axisConfig?.regionKey ?? props.xAxisKey;
  const metricKey = axisConfig?.metricKey ?? props.dataKeys[0];

  const mapData = data.map((d) => ({
    name: String(d[regionKey]),
    value: Number(d[metricKey]) ?? 0,
  }));

  const values = mapData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);

  return withBaseOption({
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(20,20,30,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (p: { name?: string; value?: number | null }) =>
        p.value != null && !Number.isNaN(p.value)
          ? `<div style="font-size:12px"><b>${p.name ?? ""}</b><br/>
             ${metricKey}: <b>${Number(p.value).toLocaleString()}</b></div>`
          : `<div style="font-size:12px"><b>${p.name ?? ""}</b><br/>No data</div>`,
    },
    visualMap: {
      min: minVal,
      max: maxVal,
      left: "right",
      top: "bottom",
      text: [`${maxVal.toLocaleString()}`, `${minVal.toLocaleString()}`],
      calculable: true,
      textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
      inRange: { color: ["#1a1a2e", "#4a3f8f", "#7c6af7"] },
    },
    series: [
      {
        type: "map",
        map: "world",
        roam: true,
        emphasis: {
          label: { show: true, color: "#fff" },
          itemStyle: { areaColor: "#a78bfa" },
        },
        itemStyle: {
          areaColor: "rgba(255,255,255,0.08)",
          borderColor: "rgba(255,255,255,0.2)",
          borderWidth: 0.5,
        },
        data: mapData,
      },
    ],
  });
}
