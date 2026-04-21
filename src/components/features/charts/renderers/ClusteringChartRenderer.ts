import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "../core/chartTypes";
import { withBaseOption } from "../core/baseOption";
import { buildGrid, buildYAxis } from "../core/axisDefaults";
import { DEFAULT_SERIES_COLORS } from "../core/constants";
import { getChartAxisColors } from "../core/colorResolver";

const CLUSTER_COLORS = DEFAULT_SERIES_COLORS;

type ClusteredPoint = {
  x: number;
  y: number;
  cluster: number;
  clusterLabel?: string;
  row: Record<string, unknown>;
};

function isNumericValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
}

function toAxisName(key: string, fallback: string): string {
  const normalized = key?.trim();
  if (!normalized) return fallback;
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function toLabelName(value: string): string {
  const text = String(value ?? "").trim();
  if (!text) return "Unknown";
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function resolveScatterKeys(props: ChartOptionBuildProps): {
  xKey: string;
  yKey: string;
  clusterKey?: string;
} | null {
  const sample = props.data[0];
  if (!sample || typeof sample !== "object") return null;
  const columns = Object.keys(sample);
  const numericColumns = columns.filter((c) =>
    props.data.some((r) => isNumericValue(r[c])),
  );
  if (numericColumns.length < 2) return null;

  const xKey =
    props.axisConfig?.xAxisKey && columns.includes(props.axisConfig.xAxisKey)
      ? props.axisConfig.xAxisKey
      : props.xAxisKey && columns.includes(props.xAxisKey)
        ? props.xAxisKey
        : numericColumns[0];
  const yKey =
    props.axisConfig?.yAxisKey && columns.includes(props.axisConfig.yAxisKey)
      ? props.axisConfig.yAxisKey
      : numericColumns.find((c) => c !== xKey) ?? numericColumns[1];

  const hintedCluster = props.axisConfig?.categoryKey;
  const nonNumericColumns = columns.filter((c) => !numericColumns.includes(c));
  const preferredCategorical = nonNumericColumns.find((c) =>
    /tier|segment|group|cluster|label|category|type|status|class/i.test(c),
  );
  const inferredCluster =
    hintedCluster && columns.includes(hintedCluster)
      ? hintedCluster
      : columns.find((c) => /cluster|group|segment|label/i.test(c)) ??
        preferredCategorical ??
        nonNumericColumns.find((c) => c !== xKey && c !== yKey);

  return { xKey, yKey, clusterKey: inferredCluster };
}

function kMeans(
  points: Array<{ x: number; y: number }>,
  requestedClusters: number,
): number[] {
  const count = points.length;
  const k = Math.max(2, Math.min(requestedClusters, Math.min(9, count)));
  if (count <= k) return points.map((_, i) => i);

  const centroids = Array.from({ length: k }, (_, i) => {
    const p = points[Math.floor((i * count) / k)];
    return { x: p.x, y: p.y };
  });
  const assignments = new Array<number>(count).fill(0);

  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < count; i++) {
      const p = points[i];
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < k; c++) {
        const dx = p.x - centroids[c].x;
        const dy = p.y - centroids[c].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          best = c;
        }
      }
      assignments[i] = best;
    }

    const next = Array.from({ length: k }, () => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < count; i++) {
      const c = assignments[i];
      next[c].x += points[i].x;
      next[c].y += points[i].y;
      next[c].n += 1;
    }
    for (let c = 0; c < k; c++) {
      if (next[c].n > 0) {
        centroids[c].x = next[c].x / next[c].n;
        centroids[c].y = next[c].y / next[c].n;
      }
    }
  }
  return assignments;
}

export function buildClusteringOption(
  props: ChartOptionBuildProps,
): EChartsOption {
  const { data, compact = false, title, isDark = true } = props;
  const { labelColor, splitLineColor, axisLineColor } = getChartAxisColors(isDark);

  const tooltipBg = isDark ? "rgba(20,20,30,0.92)" : "rgba(255,255,255,0.96)";
  const tooltipBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const tooltipText = isDark ? "#fff" : "#111827";
  const tooltipSubText = isDark ? "#9CA3AF" : "#6b7280";
  const tooltipSeparator = isDark ? "#4B5563" : "#e5e7eb";
  const tooltipFieldText = isDark ? "#D1D5DB" : "#374151";
  const dotBorder = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.18)";

  const keys = resolveScatterKeys(props);
  if (!keys) return withBaseOption({ series: [] });

  const { xKey, yKey, clusterKey } = keys;
  const rawPoints = data
    .map((row) => ({ x: Number(row[xKey]), y: Number(row[yKey]), row }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (rawPoints.length < 2) return withBaseOption({ series: [] });

  let clustered: ClusteredPoint[] = [];
  let clusterLabelById = new Map<number, string>();
  if (clusterKey) {
    const ids = new Map<string, number>();
    const fromKey = rawPoints.map((p) => {
      const rawLabel = String(p.row[clusterKey] ?? "Unknown");
      const label = toLabelName(rawLabel);
      if (!ids.has(label)) ids.set(label, ids.size);
      const clusterId = ids.get(label) ?? 0;
      return { ...p, cluster: clusterId, clusterLabel: label };
    });
    // Use precomputed cluster labels only when they meaningfully group points.
    // If every point gets a unique label (e.g. category_name), fallback to k-means.
    const uniqueClusterCount = new Set(fromKey.map((p) => p.cluster)).size;
    if (uniqueClusterCount >= rawPoints.length) {
      const desired = Math.min(6, Math.max(3, Math.round(Math.sqrt(rawPoints.length / 2))));
      const clusters = kMeans(rawPoints, desired);
      clustered = rawPoints.map((p, i) => ({
        ...p,
        cluster: clusters[i],
        clusterLabel: `Cluster ${clusters[i] + 1}`,
      }));
    } else {
      clustered = fromKey;
      for (const [label, id] of ids.entries()) {
        clusterLabelById.set(id, label);
      }
    }
  } else {
    const desired = Math.min(6, Math.max(3, Math.round(Math.sqrt(rawPoints.length / 2))));
    const clusters = kMeans(rawPoints, desired);
    clustered = rawPoints.map((p, i) => ({
      ...p,
      cluster: clusters[i],
      clusterLabel: `Cluster ${clusters[i] + 1}`,
    }));
  }

  const clusterCount = Math.max(...clustered.map((p) => p.cluster)) + 1;
  if (clusterLabelById.size === 0) {
    for (let i = 0; i < clusterCount; i++) {
      clusterLabelById.set(i, `Cluster ${i + 1}`);
    }
  }
  const pieces = Array.from({ length: clusterCount }, (_, i) => ({
    value: i,
    label: clusterLabelById.get(i) ?? `Cluster ${i + 1}`,
    color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
  }));

  const xVals = clustered.map((p) => p.x);
  const yVals = clustered.map((p) => p.y);
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals);
  const yMax = Math.max(...yVals);
  const xPad = Math.max(0.6, (xMax - xMin) * 0.08);
  const yPad = Math.max(0.6, (yMax - yMin) * 0.08);
  const xAxisName = toAxisName(xKey, "Total Orders");
  const yAxisName = toAxisName(yKey, "Total Spend");

  const yAxisBase = buildYAxis(compact, true, undefined, isDark);
  return withBaseOption({
    grid: {
      ...buildGrid(compact, Boolean(title)),
      ...(compact ? {} : { left: 120, right: 96, bottom: 72 }),
    },
    xAxis: {
      type: "value",
      scale: true,
      show: !compact,
      min: xMin - xPad,
      max: xMax + xPad,
      name: compact ? undefined : xAxisName,
      nameLocation: "middle",
      nameGap: 36,
      nameTextStyle: {
        color: labelColor,
        fontSize: 12,
        fontWeight: 500,
      },
      axisLine: { lineStyle: { color: axisLineColor } },
      axisTick: { show: false },
      axisLabel: compact
        ? { show: false }
        : { color: labelColor, fontSize: 11, hideOverlap: true },
      splitLine: {
        show: !compact,
        lineStyle: { color: splitLineColor },
      },
    },
    yAxis: {
      ...yAxisBase,
      scale: true,
      min: yMin - yPad,
      max: yMax + yPad,
      name: compact ? undefined : yAxisName,
      nameLocation: "middle",
      nameGap: 52,
      nameTextStyle: {
        color: labelColor,
        fontSize: 12,
        fontWeight: 500,
      },
    },
    tooltip: compact
      ? { show: false }
      : {
          position: "top",
          trigger: "item",
          renderMode: "html",
          appendToBody: true,
          confine: false,
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: 1,
          textStyle: { color: tooltipText, fontSize: 12 },
          formatter: (param: {
            value?: number[];
            marker?: string;
            data?: {
              value?: number[];
              clusterLabel?: string;
              row?: Record<string, unknown>;
            };
          }) => {
            const v = param.value ?? param.data?.value ?? [];
            const clusterIndex = Number(v[2] ?? 0);
            const clusterLabel =
              param.data?.clusterLabel ??
              clusterLabelById.get(clusterIndex) ??
              `Cluster ${clusterIndex + 1}`;
            const xText = Number(v[0] ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: 5,
            });
            const yText = Number(v[1] ?? 0).toLocaleString(undefined, {
              maximumFractionDigits: 5,
            });
            const row = param.data?.row ?? {};
            const extraEntries = Object.entries(row).filter(([k, val]) => {
              if (k === xKey || k === yKey || k === clusterKey) return false;
              if (val === null || val === undefined || typeof val === "object") return false;
              return true;
            });
            const extraBlock =
              extraEntries.length > 0
                ? `
                  <div style="margin-top:6px;padding-top:6px;border-top:1px solid ${tooltipSeparator};font-size:11px;color:${tooltipSubText}">Other fields</div>
                  ${extraEntries
                    .slice(0, 4)
                    .map(
                      ([k, val]) =>
                        `<div style="font-size:11px;color:${tooltipFieldText};margin:0">${toAxisName(k, k)}: ${String(val)}</div>`,
                    )
                    .join("")}
                `
                : "";

            return `
              <div style="font-size:12px"><b>${clusterLabel}</b><br/>
              ${param.marker ?? ""} ${xAxisName}: <b>${xText}</b><br/>
              ${yAxisName}: <b>${yText}</b>
              ${extraBlock}
            </div>`;
          },
        },
    visualMap: compact
      ? { show: false }
      : {
          type: "piecewise",
          orient: "vertical",
          right: 8,
          top: 24,
          bottom: 24,
          itemWidth: 14,
          itemHeight: 10,
          itemGap: 8,
          min: 0,
          max: Math.max(0, clusterCount - 1),
          splitNumber: clusterCount,
          dimension: 2,
          pieces,
          textStyle: { color: labelColor, fontSize: 11 },
        },
    series: [
      {
        type: "scatter",
        encode: { tooltip: [0, 1] },
        symbolSize: 15,
        itemStyle: {
          borderColor: dotBorder,
          borderWidth: 1,
        },
        data: clustered.map((p) => ({
          value: [p.x, p.y, p.cluster],
          clusterLabel:
            clusterLabelById.get(p.cluster) ?? p.clusterLabel ?? `Cluster ${p.cluster + 1}`,
          row: p.row,
        })),
      },
    ],
  });
}
