import type { EChartsOption } from "echarts";
import type { YAXisOption } from "echarts/types/dist/shared";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { resolveColor, getChartAxisColors } from "../core/colorResolver";
import { buildGrid, buildYAxis } from "../core/axisDefaults";
import { withBaseOption } from "../core/baseOption";

export function buildScatterOption(props: ChartOptionBuildProps): EChartsOption {
  const { data, axisConfig, config, compact = false, title, isDark = true } = props;
  const { labelColor, splitLineColor, axisLineColor } = getChartAxisColors(isDark);

  const tooltipBg = isDark ? "rgba(20,20,30,0.92)" : "rgba(255,255,255,0.96)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const tooltipText = isDark ? "#fff" : "#111827";
  const dotBorder = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";

  const xKey =
    axisConfig?.xAxisKey ?? props.xAxisKey ?? props.dataKeys[0];
  const yKey = axisConfig?.yAxisKey ?? props.dataKeys[1] ?? "";

  if (!xKey || !yKey) {
    if (import.meta.env.DEV) {
      console.warn("[ScatterChartRenderer] Missing xKey or yKey", {
        axisConfig,
        xAxisKey: props.xAxisKey,
        dataKeys: props.dataKeys,
      });
    }
    return withBaseOption({ series: [] });
  }

  const seriesData = data
    .map((d) => {
      const x = Number(d[xKey]);
      const y = Number(d[yKey]);
      return !Number.isNaN(x) && !Number.isNaN(y) ? ([x, y] as [number, number]) : null;
    })
    .filter((p): p is [number, number] => p !== null);

  const yValues = data.map((d) => Number(d[yKey])).filter((v) => !Number.isNaN(v));
  const xValues = data.map((d) => Number(d[xKey])).filter((v) => !Number.isNaN(v));

  if (yValues.length === 0 || xValues.length === 0 || seriesData.length === 0) {
    return withBaseOption({ series: [] });
  }

  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);

  const yRange = yMax - yMin;
  const xRange = xMax - xMin;

  const yPadding = yRange < 1 ? 1 : yRange * 0.15;
  const xPadding = xRange < 1 ? 1 : xRange * 0.1;

  let yMinMax: [number, number] | undefined;
  if (yRange === 0) {
    yMinMax = [yMin - 1, yMax + 1];
  } else if (yRange < 1) {
    yMinMax = [yMin - yPadding, yMax + yPadding];
  }

  const yAxisBase = buildYAxis(compact, true, yMinMax, isDark);

  const xDistinctCount = new Set(seriesData.map((p) => p[0])).size;
  let jitterApplied = false;
  let finalData: [number, number][] = seriesData;

  if (xDistinctCount <= 2 && seriesData.length > 0) {
    jitterApplied = true;
    finalData = seriesData.map((point, index) => {
      const offsetSeed = (index % 5) - 2;
      return [point[0] + offsetSeed * xPadding * 0.08, point[1]] as [number, number];
    });
  }

  const grid = {
    ...buildGrid(compact, Boolean(title)),
    ...(!compact ? { bottom: 72, left: 76 } : {}),
  };

  return withBaseOption({
    grid,
    xAxis: {
      type: "value",
      min: xRange === 0 ? xMin - 1 : Math.floor(xMin - xPadding),
      max: xRange === 0 ? xMax + 1 : Math.ceil(xMax + xPadding),
      name: xKey,
      nameLocation: "middle",
      nameGap: compact ? 0 : 36,
      nameTextStyle: { color: labelColor, fontSize: 11 },
      show: !compact,
      axisLabel: compact
        ? { show: false }
        : {
            fontSize: 11,
            color: labelColor,
            hideOverlap: true,
            formatter: (v: number) =>
              v >= 1_000_000
                ? `${(v / 1_000_000).toFixed(1)}M`
                : v >= 1_000
                  ? `${(v / 1_000).toFixed(0)}K`
                  : `${v}`,
          },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { show: false },
      splitLine: {
        show: !compact,
        lineStyle: { color: splitLineColor },
      },
    },
    yAxis: {
      ...yAxisBase,
      name: yKey,
      nameLocation: "middle" as const,
      nameGap: compact ? 0 : 56,
      nameTextStyle: { color: labelColor, fontSize: 11 },
      axisLabel: (
        compact
          ? { show: false as const }
          : {
              fontSize: 11,
              color: labelColor,
              hideOverlap: true,
              formatter: (v: number) =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000
                    ? `${(v / 1_000).toFixed(0)}K`
                    : `${v}`,
            }
      ) as YAXisOption["axisLabel"],
    } as YAXisOption,
    tooltip: {
      trigger: "item",
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (param: any) => {
        const idx = param.dataIndex;
        const row = typeof idx === "number" ? data[idx] : undefined;
        if (row) {
          const ox = Number(row[xKey]);
          const oy = Number(row[yKey]);
          const jitterNote = jitterApplied
            ? `<br/><span style="opacity:0.7;font-size:11px">X position jittered for visibility</span>`
            : "";
          return `<div style="font-size:12px">
          <b>${xKey}:</b> ${Number.isNaN(ox) ? "—" : ox.toLocaleString()}<br/>
          <b>${yKey}:</b> ${Number.isNaN(oy) ? "—" : oy.toLocaleString()}
          ${jitterNote}
        </div>`;
        }
        const pt: [number, number] | undefined = param.value;
        if (!pt || pt.length < 2) return "";
        return `<div style="font-size:12px">
          <b>${xKey}:</b> ${Number(pt[0]).toLocaleString()}<br/>
          <b>${yKey}:</b> ${Number(pt[1]).toLocaleString()}
        </div>`;
      },
    },
    series: [
      {
        type: "scatter",
        symbolSize: xRange < 5 ? 16 : 10,
        data: finalData,
        itemStyle: {
          color: resolveColor(
            config,
            yKey,
            Math.max(0, props.dataKeys.indexOf(yKey)),
            props.colors
          ),
          opacity: 0.75,
          borderColor: dotBorder,
          borderWidth: 1,
        },
        emphasis: {
          focus: "series",
          itemStyle: { opacity: 1, borderWidth: 2 },
        },
      },
    ],
  });
}