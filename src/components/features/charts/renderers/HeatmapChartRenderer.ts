import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { withBaseOption } from "../core/baseOption";

type HeatmapTriple = [number, number, number];

type HeatmapTransform = {
  xLabels: string[];
  yLabels: string[];
  data: HeatmapTriple[];
  minValue: number;
  maxValue: number;
};

function toFiniteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function buildWideFormatHeatmap(
  rows: Record<string, unknown>[],
  rowKey: string,
  xKeys: string[],
): HeatmapTransform | null {
  const yLabels = rows.map((row) => String(row[rowKey] ?? "").trim()).filter(Boolean);
  const xLabels = xKeys.map((key) => String(key ?? "").trim()).filter(Boolean);
  if (yLabels.length === 0 || xLabels.length === 0) return null;

  const data: HeatmapTriple[] = [];
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  rows.forEach((row, yIndex) => {
    xKeys.forEach((xKey, xIndex) => {
      const value = toFiniteNumber(row[xKey]);
      minValue = Math.min(minValue, value);
      maxValue = Math.max(maxValue, value);
      data.push([xIndex, yIndex, value]);
    });
  });

  return {
    xLabels,
    yLabels,
    data,
    minValue: Number.isFinite(minValue) ? minValue : 0,
    maxValue: Number.isFinite(maxValue) ? maxValue : 0,
  };
}

function buildLongFormatHeatmap(
  rows: Record<string, unknown>[],
  xKey: string,
  yKey: string,
  valueKey: string,
): HeatmapTransform | null {
  const xLabels = [...new Set(rows.map((row) => String(row[xKey] ?? "").trim()).filter(Boolean))];
  const yLabels = [...new Set(rows.map((row) => String(row[yKey] ?? "").trim()).filter(Boolean))];
  if (xLabels.length === 0 || yLabels.length === 0) return null;

  const xIndexMap = new Map(xLabels.map((label, index) => [label, index]));
  const yIndexMap = new Map(yLabels.map((label, index) => [label, index]));
  const totals = new Map<string, number>();

  rows.forEach((row) => {
    const xLabel = String(row[xKey] ?? "").trim();
    const yLabel = String(row[yKey] ?? "").trim();
    if (!xLabel || !yLabel) return;
    const key = `${xLabel}\t${yLabel}`;
    totals.set(key, (totals.get(key) ?? 0) + toFiniteNumber(row[valueKey]));
  });

  const data: HeatmapTriple[] = [];
  let minValue = Number.POSITIVE_INFINITY;
  let maxValue = Number.NEGATIVE_INFINITY;

  totals.forEach((value, key) => {
    const [xLabel, yLabel] = key.split("\t");
    const xIndex = xIndexMap.get(xLabel);
    const yIndex = yIndexMap.get(yLabel);
    if (xIndex === undefined || yIndex === undefined) return;
    minValue = Math.min(minValue, value);
    maxValue = Math.max(maxValue, value);
    data.push([xIndex, yIndex, value]);
  });

  return {
    xLabels,
    yLabels,
    data,
    minValue: Number.isFinite(minValue) ? minValue : 0,
    maxValue: Number.isFinite(maxValue) ? maxValue : 0,
  };
}

function transformHeatmapData(props: ChartOptionBuildProps): HeatmapTransform | null {
  const { data, axisConfig } = props;
  if (!Array.isArray(data) || data.length === 0) return null;

  const sample = data[0] ?? {};
  const columns = Object.keys(sample);
  if (columns.length < 2) return null;

  const hintedXKey = axisConfig?.xAxisKey ?? props.xAxisKey;
  const hintedYKey = axisConfig?.categoryKey;
  const hintedValueKey = axisConfig?.valueKey ?? props.dataKeys[0];

  const numericColumns = columns.filter((column) =>
    data.every((row) => row[column] === null || row[column] === undefined || Number.isFinite(Number(row[column]))),
  );
  const categoricalColumns = columns.filter((column) => !numericColumns.includes(column));

  if (columns.length >= 3 && categoricalColumns.length >= 2 && numericColumns.length >= 1) {
    const xKey = hintedXKey && columns.includes(hintedXKey) ? hintedXKey : categoricalColumns[0];
    const yKey =
      hintedYKey && columns.includes(hintedYKey)
        ? hintedYKey
        : categoricalColumns.find((column) => column !== xKey) ?? categoricalColumns[1];
    const valueKey =
      hintedValueKey && columns.includes(hintedValueKey)
        ? hintedValueKey
        : numericColumns.find((column) => column !== xKey && column !== yKey) ?? numericColumns[0];

    if (xKey && yKey && valueKey && xKey !== yKey && xKey !== valueKey && yKey !== valueKey) {
      const transformed = buildLongFormatHeatmap(data, xKey, yKey, valueKey);
      if (transformed) return transformed;
    }
  }

  const rowKey =
    hintedYKey && columns.includes(hintedYKey)
      ? hintedYKey
      : categoricalColumns[0] ?? columns[0];
  const xKeys = columns.filter((column) => column !== rowKey && numericColumns.includes(column));
  if (!rowKey || xKeys.length === 0) return null;

  return buildWideFormatHeatmap(data, rowKey, xKeys);
}

export function buildHeatmapOption(props: ChartOptionBuildProps): EChartsOption {
  const { compact = false, title } = props;
  const transformed = transformHeatmapData(props);
  if (!transformed || transformed.data.length === 0) {
    return withBaseOption({ series: [] });
  }

  const { xLabels, yLabels, data, minValue, maxValue } = transformed;
  const showCellLabels =
    !compact &&
    xLabels.length <= 12 &&
    yLabels.length <= 8 &&
    data.length <= 96;

  return withBaseOption({
    grid: compact
      ? { top: 8, left: 0, right: 0, bottom: 18, containLabel: false }
      : {
          top: title ? 52 : 24,
          left: 72,
          right: 24,
          bottom: 94,
          containLabel: true,
        },
    xAxis: {
      type: "category",
      data: xLabels,
      axisLabel: {
        rotate: xLabels.length > 10 ? 32 : xLabels.length > 6 ? 22 : 0,
        fontSize: 11,
        color: "rgba(255,255,255,0.65)",
        interval: xLabels.length > 16 ? "auto" : 0,
        overflow: "truncate",
        hideOverlap: true,
        width: xLabels.length > 10 ? 68 : 90,
        margin: 10,
      },
      splitArea: { show: true },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.15)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      data: yLabels,
      axisLabel: {
        fontSize: 11,
        color: "rgba(255,255,255,0.65)",
        overflow: "truncate",
        width: 112,
        hideOverlap: true,
      },
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    visualMap: compact
      ? {
          show: false,
        }
      : [
          {
            type: "continuous",
            min: minValue,
            max: maxValue,
            calculable: false,
            realtime: false,
            orient: "horizontal",
            left: "center",
            right: undefined,
            top: undefined,
            bottom: 18,
            itemWidth: 140,
            itemHeight: 8,
            textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
            inRange: { color: ["#e8edf7", "#3b5fc0"] },
          },
        ],
    tooltip: {
      trigger: "item",
      renderMode: "html",
      appendToBody: true,
      confine: false,
      position: "top",
      backgroundColor: "rgba(20,20,30,0.92)",
      borderColor: "rgba(255,255,255,0.1)",
      borderWidth: 1,
      textStyle: { color: "#fff", fontSize: 12 },
      extraCssText: "max-width: 320px; white-space: normal; z-index: 9999;",
      formatter: (p: { value?: number[] }) => {
        const v = p.value;
        if (!v || v.length < 3) return "";
        const xLabel = xLabels[v[0] ?? 0] ?? "";
        const yLabel = yLabels[v[1] ?? 0] ?? "";
        return `${yLabel} / ${xLabel}: ${Number(v[2]).toLocaleString()}`;
      },
    },
    series: [
      {
        type: "heatmap",
        data,
        label: {
          show: showCellLabels,
          color: "#1f2937",
          fontSize: 11,
          formatter: ({ value }: { value?: number[] }) =>
            value && value.length >= 3 ? Number(value[2]).toLocaleString() : "",
        },
        itemStyle: {
          borderColor: "rgba(255,255,255,0.55)",
          borderWidth: 2,
          borderRadius: 2,
        },
        emphasis: {
          itemStyle: {
            borderColor: "rgba(59,95,192,0.9)",
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: "rgba(0,0,0,0.18)",
          },
        },
      },
    ],
  });
}
