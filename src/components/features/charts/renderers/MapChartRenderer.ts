import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { withBaseOption } from "../core/baseOption";

const MAP_HIGHLIGHT_COLORS = [
  "#8B5CF6",
  "#06B6D4",
  "#F59E0B",
  "#22C55E",
  "#EF4444",
  "#6366F1",
  "#EC4899",
  "#14B8A6",
];

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  usa: "United States",
  us: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states": "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  britain: "United Kingdom",
  "great britain": "United Kingdom",
  england: "United Kingdom",
  "south korea": "South Korea",
  korea: "South Korea",
  "north korea": "North Korea",
  uae: "United Arab Emirates",
  "united arab emirates": "United Arab Emirates",
  russia: "Russia",
  "czech republic": "Czechia",
  vietnam: "Vietnam",
};

function normalizeCountryName(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalizedKey = raw.toLowerCase().replace(/\s+/g, " ");
  return COUNTRY_NAME_ALIASES[normalizedKey] ?? raw;
}

/**
 * Builds a choropleth on the registered `"world"` map.
 * Call `ensureWorldMapRegistered()` before rendering (handled in `ChartCard`).
 */
export function buildMapOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig, compact = false } = props;
  const regionKey = axisConfig?.regionKey ?? props.xAxisKey;
  const metricKey = axisConfig?.metricKey ?? props.dataKeys[0];

  const mapData = data
    .map((d, index) => ({
      name: normalizeCountryName(d[regionKey]),
      value: Number(d[metricKey]),
      itemStyle: {
        areaColor: MAP_HIGHLIGHT_COLORS[index % MAP_HIGHLIGHT_COLORS.length],
      },
    }))
    .filter((d) => d.name && Number.isFinite(d.value));

  const values = mapData.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const useDistinctCountryColors = mapData.length > 0 && mapData.length <= 8;

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
    visualMap: useDistinctCountryColors
      ? undefined
      : {
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
        roam: !compact,
        selectedMode: false,
        label: {
          show: false,
          color: "rgba(255,255,255,0.72)",
          fontSize: 10,
        },
        emphasis: {
          label: {
            show: false,
            color: "#fff",
          },
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 1.2,
            shadowBlur: 12,
            shadowColor: "rgba(255,255,255,0.25)",
          },
        },
        itemStyle: {
          areaColor: useDistinctCountryColors
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.08)",
          borderColor: "rgba(255,255,255,0.2)",
          borderWidth: 0.5,
        },
        data: mapData,
      },
    ],
  });
}
