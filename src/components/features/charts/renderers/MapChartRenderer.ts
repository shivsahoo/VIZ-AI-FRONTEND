import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { withBaseOption } from "../core/baseOption";
import { getChartAxisColors } from "../core/colorResolver";

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
  const { data, axisConfig, compact = false, isDark = true } = props;
  const { labelColor } = getChartAxisColors(isDark);

  const tooltipBg = isDark ? "rgba(20,20,30,0.92)" : "rgba(255,255,255,0.96)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const tooltipText = isDark ? "#fff" : "#111827";

  // Map fill colors — dark: near-black base, light: near-white base
  const defaultAreaColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const defaultAreaColorDistinct = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const borderColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)";
  const emphasisBorderColor = isDark ? "#ffffff" : "#333333";
  const emphasisShadowColor = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";

  // Choropleth gradient — light mode uses a softer purple range
  const choroplethColors = isDark
    ? ["#1a1a2e", "#4a3f8f", "#7c6af7"]
    : ["#e8e4ff", "#a78bfa", "#7c6af7"];

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
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      textStyle: { color: tooltipText, fontSize: 12 },
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
          textStyle: { color: labelColor, fontSize: 11 },
          inRange: { color: choroplethColors },
        },
    series: [
      {
        type: "map",
        map: "world",
        roam: !compact,
        selectedMode: false,
        label: {
          show: false,
          color: labelColor,
          fontSize: 10,
        },
        emphasis: {
          label: {
            show: false,
            color: isDark ? "#fff" : "#111827",
          },
          itemStyle: {
            borderColor: emphasisBorderColor,
            borderWidth: 1.2,
            shadowBlur: 12,
            shadowColor: emphasisShadowColor,
          },
        },
        itemStyle: {
          areaColor: useDistinctCountryColors
            ? defaultAreaColorDistinct
            : defaultAreaColor,
          borderColor: borderColor,
          borderWidth: 0.5,
        },
        data: mapData,
      },
    ],
  });
}
