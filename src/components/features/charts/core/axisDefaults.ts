import type { EChartsOption } from "echarts";

export function buildGrid(
  compact: boolean,
  hasTitle: boolean,
): EChartsOption["grid"] {
  if (compact) {
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      containLabel: false,
    };
  }
  return {
    top: hasTitle ? 52 : 20,
    right: 24,
    bottom: 90,
    left: 64,
    containLabel: false,
  };
}

export function buildXAxis(
  compact: boolean,
  categories: (string | number)[],
  chartType: "bar" | "line" | "area",
  formatCategory: (v: string | number) => string,
): EChartsOption["xAxis"] {
  if (compact) {
    return {
      type: "category",
      data: categories,
      show: false,
      boundaryGap: chartType === "bar",
    };
  }
  return {
    type: "category",
    data: categories,
    boundaryGap: chartType === "bar",
    axisLabel: {
      rotate: 35,
      interval: 0,
      overflow: "truncate",
      width: 100,
      fontSize: 11,
      color: "rgba(255,255,255,0.65)",
      margin: 12,
      formatter: formatCategory,
    },
    axisLine: {
      lineStyle: { color: "rgba(255,255,255,0.15)" },
    },
    axisTick: { show: false },
  };
}

export function buildYAxis(
  compact: boolean,
  showGrid: boolean,
  yMinMax: [number, number] | undefined,
): EChartsOption["yAxis"] {
  if (compact) {
    return {
      type: "value",
      show: false,
    };
  }
  return {
    type: "value",
    min: yMinMax ? yMinMax[0] : undefined,
    max: yMinMax ? yMinMax[1] : undefined,
    axisLabel: {
      fontSize: 11,
      color: "rgba(255,255,255,0.65)",
      formatter: (value: number | string) => {
        const v = typeof value === "number" ? value : Number(value);
        if (Number.isNaN(v)) return String(value);
        if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
        return `${v}`;
      },
    },
    splitLine: showGrid
      ? {
          lineStyle: { color: "rgba(255,255,255,0.08)" },
        }
      : { show: false },
    axisLine: { show: false },
    axisTick: { show: false },
  };
}
