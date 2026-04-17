import type { EChartsOption, LineSeriesOption } from "echarts";
import type { ChartOptionBuildProps } from "../core/chartTypes";
import {
  formatExtraFieldsBlock,
  formatTooltipValue,
} from "../ChartTooltip";
import { buildGrid, buildXAxis, buildYAxis } from "../core/axisDefaults";
import { buildEChartsTheme, resolveColor } from "../core/colorResolver";
import { DEFAULT_SERIES_COLORS } from "../core/constants";
import { buildAxisTooltipShell } from "../core/tooltipDefaults";
import { isDateStringSample } from "../core/pieHelpers";

const CHART_STYLE = { height: '400px', width: '100%' }

const STRICT_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/;

function looksLikeDate(value: unknown): boolean {
  return typeof value === "string" && STRICT_ISO_DATE_RE.test(value.trim());
}

function sortTimeKeys(uniqueKeys: Set<string>) {
  const keys = [...uniqueKeys]
  const withParse = keys.map((k) => ({ k, t: looksLikeDate(k) ? Date.parse(String(k)) : Number.NaN }))
  if (withParse.length && withParse.every((x) => !Number.isNaN(x.t))) {
    return withParse.sort((a, b) => a.t - b.t).map((x) => x.k)
  }
  return keys.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }))
}

function transformSingleValueFormat(chartData: unknown[][]) {
  if (!Array.isArray(chartData) || chartData.length < 2) return null
  const headers = chartData[0]
  const row = chartData[1]
  if (!Array.isArray(headers) || !Array.isArray(row) || headers.length !== 1 || row.length < 1) {
    return null
  }

  const raw = row[0]
  const n = Number(raw)
  if (!Number.isFinite(n)) return null

  const label = String(headers[0] ?? "value")
  return {
    xAxisData: [label],
    legendData: [label],
    series: [
      {
        name: label,
        type: "line",
        stack: "Total",
        data: [n],
      },
    ],
  }
}

/** Prefer explicit header names; otherwise fall back to indices [0, 1, 2] for long-format rows. */
function inferLongFormatColumnIndices(headers: string[]) {
  if (!Array.isArray(headers) || headers.length < 3) return null

  const lower = headers.map((h) => String(h ?? '').toLowerCase())

  const scoreTime = (i: number) => {
    const h = lower[i]
    if (/^\s*(date|time|day|month|year|period|timestamp|dt|week|bucket)\s*$/i.test(h)) return 4
    if (/\b(date|time|day|month|timestamp|period)\b/.test(h)) return 3
    if (h === 'ts' || h === 't') return 2
    return 0
  }
  const scoreCat = (i: number) => {
    const h = lower[i]
    if (/^\s*(category|cat|segment|channel|type|label|name|group|product|region)\s*$/i.test(h)) return 4
    if (/\b(category|segment|channel|product|region)\b/.test(h)) return 3
    return 0
  }
  const scoreVal = (i: number) => {
    const h = lower[i]
    if (/^\s*(revenue|amount|value|total|sum|sales|qty|count|quantity)\s*$/i.test(h)) return 4
    if (/\b(revenue|amount|total|sum|sales)\b/.test(h)) return 3
    return 0
  }

  let best: { timeIdx: number; catIdx: number; valIdx: number; score: number } | null = null
  for (let ti = 0; ti < headers.length; ti++) {
    for (let ci = 0; ci < headers.length; ci++) {
      for (let vi = 0; vi < headers.length; vi++) {
        if (ti === ci || ti === vi || ci === vi) continue
        const s = scoreTime(ti) + scoreCat(ci) + scoreVal(vi)
        if (!best || s > best.score) best = { timeIdx: ti, catIdx: ci, valIdx: vi, score: s }
      }
    }
  }

  if (best && best.score >= 6) return best

  return { timeIdx: 0, catIdx: 1, valIdx: 2, score: 0 }
}

function sampleLooksLikeLongFormat(chartData: unknown[][]) {
  if (!chartData || chartData.length < 2) return false
  const headers = chartData[0]
  if (!Array.isArray(headers) || headers.length < 3) return false

  let rows = 0
  let numThird = 0
  let secondNotBareNumber = 0

  const limit = Math.min(chartData.length, 40)
  for (let r = 1; r < limit; r++) {
    const row = chartData[r]
    if (!Array.isArray(row) || row.length < 3) continue
    rows++
    const a = Number(row[2])
    if (Number.isFinite(a)) numThird++

    const raw = row[1]
    const n = Number(raw)
    const isBareNumeric =
      typeof raw === 'number'
        ? true
        : typeof raw === 'string' &&
          raw.trim() !== '' &&
          Number.isFinite(n) &&
          String(raw).trim() === String(n)

    if (!isBareNumeric) secondNotBareNumber++
  }

  if (rows === 0) return false
  return numThird / rows >= 0.65 && secondNotBareNumber / rows >= 0.45
}

/**
 * Long format: time | category dimension | revenue (numeric).
 * X = unique sorted timestamps; one line series per category; values aligned to time grid (0 if missing).
 */
function transformLongFormatPivot(chartData: unknown[][], timeIdx: number, catIdx: number, valIdx: number) {
  const timeSet = new Set<string>()
  const categorySet = new Set<string>()
  const accum = new Map<string, number>()

  for (let r = 1; r < chartData.length; r++) {
    const row = chartData[r]
    if (!Array.isArray(row) || row.length <= Math.max(timeIdx, catIdx, valIdx)) continue

    const timeKey = String(row[timeIdx] ?? '').trim()
    const catName = String(row[catIdx] ?? '').trim()
    if (!timeKey || !catName) continue

    const rawVal = row[valIdx]
    const n = Number(rawVal)
    const add = Number.isFinite(n) ? n : 0

    timeSet.add(timeKey)
    categorySet.add(catName)

    const cellKey = `${timeKey}\t${catName}`
    accum.set(cellKey, (accum.get(cellKey) || 0) + add)
  }

  if (timeSet.size === 0 || categorySet.size === 0) return null

  const xAxisData = sortTimeKeys(timeSet)
  const legendData = [...categorySet].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true }),
  )

  const series = legendData.map((categoryName) => ({
    name: categoryName,
    type: 'line',
    stack: 'Total',
    data: xAxisData.map((t) => {
      const v = accum.get(`${t}\t${categoryName}`)
      return v !== undefined ? v : 0
    }),
  }))

  return {
    xAxisData,
    legendData,
    series,
  }
}

/**
 * Wide format: first column = X (e.g. periods); each subsequent column = a separate stacked series.
 */
function transformWideFormat(chartData: unknown[][]) {
  const headers = chartData[0]
  if (!Array.isArray(headers)) return null
  const seriesNames = headers.slice(1).map((h) => String(h ?? ''))

  const categoryOrder: string[] = []
  const seen = new Set<string>()
  for (let r = 1; r < chartData.length; r++) {
    const row = chartData[r]
    if (!Array.isArray(row)) continue
    const cat = String(row[0] ?? '')
    if (!seen.has(cat)) {
      seen.add(cat)
      categoryOrder.push(cat)
    }
  }

  if (categoryOrder.length === 0) return null

  const accum = new Map<string, number>()
  for (let r = 1; r < chartData.length; r++) {
    const row = chartData[r]
    if (!Array.isArray(row)) continue
    const cat = String(row[0] ?? '')
    for (let si = 0; si < seriesNames.length; si++) {
      const key = `${cat}\t${si}`
      const raw = row[si + 1]
      const n = Number(raw)
      const add = Number.isFinite(n) ? n : 0
      accum.set(key, (accum.get(key) || 0) + add)
    }
  }

  const series = seriesNames.map((name, si) => ({
    name,
    type: 'line',
    stack: 'Total',
    data: categoryOrder.map((cat) => {
      const v = accum.get(`${cat}\t${si}`)
      return v !== undefined ? v : 0
    }),
  }))

  return {
    xAxisData: categoryOrder,
    legendData: seriesNames,
    series,
  }
}

/**
 * Transforms backend [headers, ...rows] into stacked-line xAxis, legend, and series.
 * Prefers long-format pivot (time × category → value) when rows look like that shape.
 */
export function transformStackedLineChartData(chartData: unknown[][]) {
  if (!Array.isArray(chartData) || chartData.length < 2) return null

  const headers = chartData[0]
  if (!Array.isArray(headers)) return null
  if (headers.length < 2) {
    return transformSingleValueFormat(chartData)
  }

  if (headers.length >= 3) {
    const inferred = inferLongFormatColumnIndices(headers.map((h) => String(h ?? "")))
    const sampleLong = sampleLooksLikeLongFormat(chartData)

    // Row shape: col1 ≈ category labels, col2 ≈ numeric metric → pivot (time|cat|value).
    if (sampleLong && inferred) {
      const useInferred = inferred.score >= 6
      const timeIdx = useInferred ? inferred.timeIdx : 0
      const catIdx = useInferred ? inferred.catIdx : 1
      const valIdx = useInferred ? inferred.valIdx : 2
      const pivoted = transformLongFormatPivot(chartData, timeIdx, catIdx, valIdx)
      if (pivoted) return pivoted
    }

    // Strong header cues only (e.g. clearly named date / category / revenue columns).
    if (!sampleLong && inferred && inferred.score >= 9) {
      const pivoted = transformLongFormatPivot(
        chartData,
        inferred.timeIdx,
        inferred.catIdx,
        inferred.valIdx,
      )
      if (pivoted) return pivoted
    }
  }

  return transformWideFormat(chartData)
}

function buildStackedLineOption(
  transformed: any,
  props: ChartOptionBuildProps,
): EChartsOption {
  if (!transformed) return {}

  type NormalizedStackedLineSeries = LineSeriesOption

  const {
    compact = false,
    showLegend,
    showGrid = true,
    colors = DEFAULT_SERIES_COLORS,
    strokeWidth = 2,
    config,
    data,
    extraFields,
    title,
  } = props;

  const legendVisible =
    showLegend !== undefined
      ? showLegend
      : (transformed.legendData?.length ?? 0) > 1;
  const sampleX = transformed.xAxisData?.[0];
  const xIsDate = isDateStringSample(sampleX);
  const formatAxisCategoryLabel = (val: string | number): string => {
    if (xIsDate) {
      try {
        const d = new Date(val as string);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          });
        }
      } catch {
        /* fall through */
      }
    }
    return String(val);
  };

  const themeColorList = buildEChartsTheme(config ?? {}).color;
  const pickColor = (i: number, key: string) =>
    resolveColor(config, key, i, colors, themeColorList);
  const showPointSymbols = !compact && (transformed.xAxisData?.length ?? 0) <= 12;

  const normalizedSeries: NormalizedStackedLineSeries[] = (transformed.series ?? []).map(
    (s: any, index: number) => ({
      // Ensure proper stacked line semantics are preserved
      type: "line" as const,
      stack: "Total",
      name: config?.[String(s?.name ?? "")]?.label ?? s?.name,
      data: s?.data,
      smooth: false,
      showSymbol: showPointSymbols,
      symbolSize: showPointSymbols ? 6 : 0,
      connectNulls: true,
      lineStyle: { width: strokeWidth },
      itemStyle: { color: pickColor(index, String(s?.name ?? index)) },
      emphasis: { focus: "series" },
    }),
  );

  if (
    normalizedSeries.length === 0 ||
    normalizedSeries.every((series: NormalizedStackedLineSeries) => !Array.isArray(series.data) || series.data.length === 0)
  ) {
    return {};
  }

  const axisTooltipFormatter = (params: unknown): string => {
    const list = (Array.isArray(params) ? params : [params]) as Array<{
      axisValue?: unknown;
      axisValueLabel?: unknown;
      dataIndex?: number;
      seriesName?: string;
      value?: unknown;
      color?: string;
    }>;
    if (!list.length) return "";
    const label =
      list[0]?.axisValueLabel ?? list[0]?.axisValue ?? "";
    const dataIndex =
      typeof list[0]?.dataIndex === "number" ? list[0].dataIndex : 0;
    const row = data?.[dataIndex] as Record<string, unknown> | undefined;
    const rows = list
      .map((p) => {
        const num = Number(p.value);
        const valText = Number.isFinite(num)
          ? num.toLocaleString()
          : formatTooltipValue(
              p.value as number | string,
              String(p.seriesName ?? ""),
              row,
            );
        return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color ?? "#ccc"};margin-right:6px;"></span>${p.seriesName ?? ""}: <b>${valText}</b>`;
      })
      .join("<br/>");
    let html = `<div style="font-size:12px"><b>${String(label)}</b><br/>${rows}</div>`;
    html += formatExtraFieldsBlock(
      row,
      new Set((transformed.legendData ?? []).map((k: unknown) => String(k))),
      extraFields,
    );
    return html;
  };

  return {
    animation: compact ? false : true,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "inherit" },
    tooltip: compact ? { show: false } : buildAxisTooltipShell(axisTooltipFormatter),
    legend: compact
      ? { show: false }
      : {
          show: legendVisible,
          left: 12,
          right: 12,
          bottom: 0,
          textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
          data: (transformed.legendData ?? []).map((name: unknown) =>
            config?.[String(name ?? "")]?.label ?? String(name ?? ""),
          ),
        },
    grid: buildGrid(compact, Boolean(title)),
    xAxis: buildXAxis(
      compact,
      transformed.xAxisData as (string | number)[],
      "line",
      formatAxisCategoryLabel,
    ),
    yAxis: buildYAxis(compact, showGrid, undefined),
    series: normalizedSeries,
  }
}

function toMatrixFromRows(rows: Record<string, unknown>[]): unknown[][] {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const headers = Object.keys(rows[0] ?? {})
  const matrix: unknown[][] = [headers]
  for (const row of rows) {
    matrix.push(headers.map((h) => row?.[h]))
  }
  return matrix
}

/**
 * Stacked line chart for query results: [headers, ...dataRows].
 * Long format (date, category, revenue): pivots so each category is a stacked series over time.
 */
export function StackedLineChart({ chartData }: { chartData: unknown[][] }) {
  const transformed = transformStackedLineChartData(chartData)
  const option = buildStackedLineOption(transformed, {
    data: [],
    dataKeys: [],
    xAxisKey: "",
    type: "stackedlinechart",
  })

  return {
    transformed,
    option,
  }
}

export function buildStackedLineChartOption(
  props: ChartOptionBuildProps,
): EChartsOption {
  const matrix = toMatrixFromRows(props.data as Record<string, unknown>[])
  const transformed = transformStackedLineChartData(matrix)
  return buildStackedLineOption(transformed, {
    ...props,
    title: props.title || "Stacked Line",
  })
}

export { CHART_STYLE };
