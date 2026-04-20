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
    top: hasTitle ? 56 : 24,
    right: 28,
    bottom: 96,
    left: 68,
    containLabel: true,
  };
}

function maxFormattedCategoryLength(
  categories: (string | number)[],
  formatCategory: (v: string | number) => string,
): number {
  let max = 0;
  for (const c of categories) {
    const len = String(formatCategory(c)).length;
    if (len > max) max = len;
  }
  return max;
}

/** Bar charts with few categories but long names need diagonal labels so none are dropped by overlap logic. */
function shouldRotateCategoryXAxis(
  chartType: "bar" | "line" | "area",
  categories: (string | number)[],
  formatCategory: (v: string | number) => string,
): boolean {
  if (categories.length > 6) return true;
  const longest = maxFormattedCategoryLength(categories, formatCategory);
  if (chartType === "bar") {
    if (longest >= 10) return true;
    if (categories.length >= 4 && longest >= 8) return true;
  }
  return false;
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
  const rotated = shouldRotateCategoryXAxis(chartType, categories, formatCategory);
  const barRotated = chartType === "bar" && rotated;
  return {
    type: "category",
    data: categories,
    boundaryGap: chartType === "bar",
    axisLabel: {
      rotate: rotated ? 30 : 0,
      interval: 0,
      overflow: "truncate",
      hideOverlap: barRotated ? false : true,
      width: rotated ? 92 : 120,
      fontSize: 11,
      color: "rgba(255,255,255,0.65)",
      margin: 14,
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
    splitNumber: 4,
    axisLabel: {
      fontSize: 11,
      color: "rgba(255,255,255,0.65)",
      margin: 10,
      hideOverlap: true,
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
