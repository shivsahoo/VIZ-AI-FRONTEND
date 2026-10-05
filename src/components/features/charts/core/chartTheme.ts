import type { EChartsOption } from "echarts";

import { SERIES_PALETTE_DARK, SERIES_PALETTE_LIGHT } from "./constants";
import { humanizeKey, isPercentKey } from "./labels";

/**
 * Final styling pass applied to every chart option in ChartCard.
 *
 * Renderers decide *what* to draw; this decides how it looks, so all chart
 * types share one visual language: one palette, scrollable dot legends,
 * rounded bars with soft tracks, smooth lines with fading area fills, spaced
 * pie slices and a single tooltip style. It only fills in presentation —
 * data, axes types, formatters and layout decisions stay the renderer's.
 */

const FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif';

// Colours from the previous theme that may still arrive via saved chart
// configs or renderer constants, mapped onto palette slots.
const LEGACY_SLOT: Record<string, number> = {
  "#8b5cf6": 0,
  "#7c6af7": 0,
  "#6366f1": 3,
  "#06b6d4": 2,
  "#22d3ee": 2,
  "#f59e0b": 5,
  "#ef4444": 9,
  "#10b981": 8,
  "#22c55e": 8,
  "#ec4899": 9,
  "#14b8a6": 4,
  "#60a5fa": 2,
  "#a78bfa": 6,
  "#818cf8": 6,
};

const LIGHT_SLOT = new Map(SERIES_PALETTE_LIGHT.map((c, i) => [c.toLowerCase(), i]));

function themedColor(color: string, isDark: boolean): string {
  const key = color.toLowerCase();
  const slot = LIGHT_SLOT.get(key) ?? LEGACY_SLOT[key];
  if (slot === undefined) return color;
  return (isDark ? SERIES_PALETTE_DARK : SERIES_PALETTE_LIGHT)[slot];
}

/** Recolour every `color` field (string or array) anywhere in the option. */
function recolor(node: unknown, isDark: boolean, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) recolor(item, isDark, depth + 1);
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    // Raw data rows attached for tooltips are user data, never styling.
    if (key === "row" || key === "__row" || key === "value" || key === "__otherBreakdown") continue;
    if (key === "color") {
      if (typeof value === "string") obj[key] = themedColor(value, isDark);
      else if (Array.isArray(value))
        obj[key] = value.map((v) => (typeof v === "string" ? themedColor(v, isDark) : v));
      else recolor(value, isDark, depth + 1);
    } else if (key !== "data" || depth < 3) {
      // Skip deep data arrays (rows), but still visit series[].data items one level down
      // so per-slice itemStyle colours (pie, funnel) are themed.
      recolor(value, isDark, depth + 1);
    }
  }
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/** Short, human date labels for category axes that hold ISO dates/timestamps. */
function dateLabelFormatter(values: unknown[]): ((v: string | number) => string) | null {
  const strs = values.filter((v) => typeof v === "string") as string[];
  if (strs.length < 2 || !strs.every((v) => ISO_DATE.test(v.trim()))) return null;
  // Timestamps without a zone are wall-clock dates: read them as UTC so
  // "2024-03-01T00:00:00" stays March in every timezone.
  const parse = (v: string) => new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.trim().slice(0, 10)}T${(v.trim().slice(11) || "00:00:00")}Z`);
  const dates = strs.map(parse);
  if (dates.some((d) => Number.isNaN(d.getTime()))) return null;
  const monthly = strs.every((v) => /^\d{4}-\d{2}-01/.test(v));
  const years = new Set(dates.map((d) => d.getUTCFullYear()));
  return (v) => {
    const d = parse(String(v));
    if (Number.isNaN(d.getTime())) return String(v);
    if (monthly) {
      return d.toLocaleDateString("en-US", { month: "short", year: years.size > 1 ? "2-digit" : undefined, timeZone: "UTC" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  };
}

const asArray = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

type AnyObj = Record<string, any>;

const fmtCompact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `${Number(v.toFixed(2))}`;
};

function seriesMax(series: AnyObj): number {
  const data = Array.isArray(series?.data) ? series.data : [];
  let m = 0;
  for (const d of data) {
    const v = typeof d === "number" ? d : Number(Array.isArray(d) ? d[1] : d?.value ?? d);
    if (Number.isFinite(v) && Math.abs(v) > m) m = Math.abs(v);
  }
  return m;
}

/**
 * Decisions a human designer would make that individual renderers don't:
 *  - readable series names (occupancy_rate_pct → "Occupancy rate (%)")
 *  - metrics on wildly different scales get their own right-hand axis
 *  - category labels: flat & wrapped when few, angled when moderate,
 *    a zoom window when there are too many to fit
 *  - downsampling / large mode for big series
 *  - legend moves to the top when it's long or a zoom slider is showing
 */
function applySmartLayout(option: AnyObj) {
  const seriesList = asArray<AnyObj>(option.series).filter(Boolean);
  const cartesian = seriesList.some((x) => x.type === "bar" || x.type === "line");

  // 1) Names
  const rename = new Map<string, string>();
  for (const x of seriesList) {
    if (typeof x.name === "string") {
      const h = humanizeKey(x.name);
      if (h !== x.name) rename.set(x.name, h);
      x.name = h;
    }
  }
  if (option.legend) {
    option.legend = asArray<AnyObj>(option.legend).map((l) =>
      l && Array.isArray(l.data)
        ? { ...l, data: l.data.map((d: unknown) => (typeof d === "string" ? rename.get(d) ?? d : d)) }
        : l,
    );
  }
  for (const key of ["xAxis", "yAxis"] as const) {
    for (const ax of asArray<AnyObj>(option[key])) {
      if (ax && typeof ax.name === "string") ax.name = humanizeKey(ax.name);
    }
  }

  if (!cartesian) return;
  const xAxes = asArray<AnyObj>(option.xAxis);
  const yAxes = asArray<AnyObj>(option.yAxis);
  const vertical = xAxes[0]?.type === "category" && yAxes[0]?.type === "value";

  // 2) Mixed scales → secondary axis (only when the chart has a single value axis)
  if (vertical && yAxes.length === 1 && seriesList.length >= 2 && !seriesList.some((x) => x.stack)) {
    const maxes = seriesList.map(seriesMax);
    const top = Math.max(...maxes);
    const small = seriesList.filter((_x, i) => maxes[i] > 0 && top / maxes[i] >= 15);
    if (small.length > 0 && small.length < seriesList.length) {
      const percent = small.every((x) => isPercentKey(String(x.name ?? "")));
      const secondary: AnyObj = {
        type: "value",
        position: "right",
        splitLine: { show: false },
        axisLabel: { formatter: (v: number) => (percent ? `${Number(v.toFixed(1))}%` : fmtCompact(v)) },
      };
      option.yAxis = [yAxes[0], secondary];
      for (const x of small) {
        x.yAxisIndex = 1;
        if (x.type === "bar") {
          x.type = "line";
          x.symbol = "circle";
          x.showSymbol = true;
          x.symbolSize = 7;
          delete x.barMaxWidth;
          delete x.showBackground;
          delete x.backgroundStyle;
        }
      }
    }
  }

  // 3) Category labels + zoom for long axes
  let slider = false;
  const catKey = vertical ? "xAxis" : yAxes[0]?.type === "category" ? "yAxis" : null;
  if (catKey) {
    const axes = asArray<AnyObj>(option[catKey]);
    const ax = axes[0];
    const n = Array.isArray(ax?.data) ? ax.data.length : 0;
    if (ax && n > 0 && ax.show !== false) {
      const label: AnyObj = { ...(ax.axisLabel ?? {}) };
      const isDateAxis = typeof label.formatter === "function" && label.rotate === 0 && label.interval === "auto";
      if (catKey === "xAxis" && !isDateAxis) {
        if (n <= 5) Object.assign(label, { rotate: 0, interval: 0, overflow: "break", width: 88, lineHeight: 14, hideOverlap: false });
        // Angled + truncated; beyond 24 the zoom window keeps ~18 in view so every bar stays labelled
        else Object.assign(label, { rotate: 35, interval: 0, overflow: "truncate", width: 84, hideOverlap: true });
      } else if (catKey === "yAxis") {
        Object.assign(label, { overflow: "truncate", width: 120 });
      }
      axes[0] = { ...ax, axisLabel: label };
      option[catKey] = Array.isArray(option[catKey]) ? axes : axes[0];

      const zoomAt = isDateAxis ? 60 : 24;
      const windowSize = isDateAxis ? 36 : 18;
      if (n > zoomAt && !option.dataZoom) {
        slider = true;
        const end = Math.min(100, (windowSize / n) * 100);
        const axisIndexKey = catKey === "xAxis" ? "xAxisIndex" : "yAxisIndex";
        option.dataZoom = [
          { type: "inside", [axisIndexKey]: 0, start: 0, end, zoomOnMouseWheel: "shift", moveOnMouseWheel: true },
          {
            type: "slider",
            [axisIndexKey]: 0,
            start: 0,
            end,
            height: catKey === "xAxis" ? 18 : undefined,
            width: catKey === "yAxis" ? 14 : undefined,
            bottom: catKey === "xAxis" ? 6 : undefined,
            right: catKey === "yAxis" ? 4 : undefined,
            brushSelect: false,
            showDetail: false,
            borderColor: "transparent",
            fillerColor: "rgba(0,113,227,0.14)",
            handleSize: "120%",
            dataBackground: { lineStyle: { opacity: 0.3 }, areaStyle: { opacity: 0.12 } },
          },
        ];
      }
    }
  }

  // 4) Big series
  for (const x of seriesList) {
    const len = Array.isArray(x.data) ? x.data.length : 0;
    if (x.type === "line" && len > 120) {
      x.sampling = "lttb";
      x.showSymbol = false;
    }
    if (x.type === "bar" && len > 400) x.large = true;
  }

  // 5) Legend placement + room for the slider
  const legends = asArray<AnyObj>(option.legend);
  const legend = legends[0];
  const legendVisible = legend && legend.show !== false && legend.orient !== "vertical";
  const longLegend = seriesList.length > 5;
  const grids = asArray<AnyObj>(option.grid);
  const grid = grids[0] ? { ...grids[0] } : undefined;
  if (legendVisible && (slider || longLegend)) {
    legends[0] = { ...legend, top: 0, bottom: undefined, left: 0, right: 0 };
    option.legend = legends;
    if (grid) grid.top = Math.max(Number(grid.top) || 0, 40);
  }
  if (grid && slider) {
    if (catKey === "xAxis") grid.bottom = Math.max(Number(grid.bottom) || 0, 34) + (legendVisible && !(slider || longLegend) ? 0 : 0);
    else grid.right = Math.max(Number(grid.right) || 0, 28);
  }
  if (grid) option.grid = Array.isArray(option.grid) ? [grid, ...grids.slice(1)] : grid;
}

export function applyChartTheme(
  input: EChartsOption,
  { isDark, compact }: { isDark: boolean; compact: boolean },
): EChartsOption {
  if (!input || !Object.keys(input).length) return input;
  // Shallow-clone the containers we touch; functions (formatters) are kept by reference.
  const option: AnyObj = { ...input };

  const ink = isDark ? "#f5f5f7" : "#1d1d1f";
  const muted = isDark ? "#a1a1a6" : "#6e6e73";
  const surface = isDark ? "#1c1c1e" : "#ffffff";
  const track = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";
  const grid = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)";

  option.backgroundColor = "transparent";
  option.textStyle = { ...(option.textStyle ?? {}), fontFamily: FONT_STACK };
  option.animationDuration = option.animationDuration ?? 700;
  option.animationEasing = option.animationEasing ?? "cubicOut";

  // ── Tooltip ──
  if (!compact && option.tooltip && typeof option.tooltip === "object" && !Array.isArray(option.tooltip)) {
    const t: AnyObj = { ...option.tooltip };
    // Pie tooltips render their own HTML card on a transparent shell; leave those.
    if (t.backgroundColor !== "transparent") {
      t.backgroundColor = isDark ? "rgba(44,44,46,0.96)" : "rgba(255,255,255,0.97)";
      t.borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
      t.borderWidth = 1;
      t.padding = [10, 14];
      t.textStyle = { ...(t.textStyle ?? {}), color: ink, fontSize: 12, fontFamily: FONT_STACK };
      t.extraCssText = `${t.extraCssText ?? ""};border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,${isDark ? 0.45 : 0.12});backdrop-filter:blur(20px);`;
    }
    if (t.axisPointer?.type === "shadow") {
      t.axisPointer = { ...t.axisPointer, shadowStyle: { color: track } };
    } else if (t.axisPointer?.type === "line" || t.trigger === "axis") {
      t.axisPointer = { type: "line", lineStyle: { color: muted, type: [4, 4], width: 1 }, ...t.axisPointer };
    }
    option.tooltip = t;
  }

  // ── Legend: dot markers, scroll instead of overflow ──
  if (!compact && option.legend) {
    option.legend = asArray<AnyObj>(option.legend).map((l) => {
      if (!l || l.show === false) return l;
      return {
        ...l,
        type: "scroll",
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: l.itemGap && l.itemGap > 12 ? l.itemGap : 16,
        textStyle: { ...(l.textStyle ?? {}), color: muted, fontSize: 12 },
        pageIconColor: ink,
        pageIconInactiveColor: isDark ? "#48484a" : "#d2d2d7",
        pageIconSize: 10,
        pageTextStyle: { color: muted, fontSize: 11 },
      };
    });
  }

  // ── Smart layout (names, mixed scales, many categories, big data) ──
  if (!compact) applySmartLayout(option);

  // ── Axes ──
  const styleAxis = (axis: AnyObj) => {
    if (!axis || axis.show === false) return axis;
    const next: AnyObj = { ...axis };
    if (next.axisLabel && next.axisLabel.show !== false) {
      next.axisLabel = { ...next.axisLabel, color: muted, fontSize: 11 };
    }
    // ISO timestamps → "Mar 24" / "Mar 5", flat and de-overlapped
    if (next.type === "category" && Array.isArray(next.data)) {
      const fmt = dateLabelFormatter(next.data);
      if (fmt) {
        next.axisLabel = {
          ...(next.axisLabel ?? {}),
          formatter: fmt,
          rotate: 0,
          interval: "auto",
          hideOverlap: true,
          width: undefined,
          overflow: undefined,
          color: muted,
          fontSize: 11,
        };
        next.axisPointer = { ...(next.axisPointer ?? {}), label: { formatter: (p: { value: string | number }) => fmt(p.value) } };
      }
    }
    if (next.nameTextStyle) next.nameTextStyle = { ...next.nameTextStyle, color: muted, fontSize: 12, fontWeight: 400 };
    if (next.splitLine && next.splitLine.show !== false) {
      next.splitLine = { ...next.splitLine, lineStyle: { ...(next.splitLine.lineStyle ?? {}), color: grid, type: [4, 4] } };
    }
    if (next.type === "value") {
      next.axisLine = { ...(next.axisLine ?? {}), show: false };
    } else if (next.axisLine?.show !== false) {
      next.axisLine = { ...(next.axisLine ?? {}), lineStyle: { ...(next.axisLine?.lineStyle ?? {}), color: grid } };
    }
    next.axisTick = { ...(next.axisTick ?? {}), show: false };
    return next;
  };
  for (const key of ["xAxis", "yAxis"] as const) {
    if (option[key]) {
      option[key] = Array.isArray(option[key]) ? option[key].map(styleAxis) : styleAxis(option[key]);
    }
  }

  // Horizontal bars: category on the y axis.
  const firstY = asArray<AnyObj>(option.yAxis)[0];
  const horizontal = firstY?.type === "category";

  // ── Series ──
  const seriesList = asArray<AnyObj>(option.series);
  const barCount = seriesList.filter((s) => s?.type === "bar").length;
  const categoryCount = Math.max(
    0,
    ...[...asArray<AnyObj>(option.xAxis), ...asArray<AnyObj>(option.yAxis)].map((a) => (Array.isArray(a?.data) ? a.data.length : 0)),
  );
  let lineIndex = 0;
  option.series = seriesList.map((s) => {
    if (!s || typeof s !== "object") return s;
    const series: AnyObj = { ...s };

    if (series.type === "bar") {
      const stacked = Boolean(series.stack);
      // Big radii turn small bars into blobs when there are many categories
      const radius = stacked ? 3 : categoryCount > 12 ? 4 : 8;
      series.itemStyle = {
        ...(series.itemStyle ?? {}),
        borderRadius: horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0],
      };
      if (!compact) {
        series.barMaxWidth = series.barMaxWidth && series.barMaxWidth < 36 ? series.barMaxWidth : 36;
        if (!stacked && barCount === 1) {
          series.showBackground = true;
          series.backgroundStyle = {
            color: track,
            borderRadius: horizontal ? [0, radius, radius, 0] : [radius, radius, 0, 0],
          };
        }
        series.emphasis = { focus: "series", ...(series.emphasis ?? {}) };
      }
    }

    if (series.type === "line") {
      const isPrimaryLine = lineIndex++ === 0;
      const color: string | undefined =
        (typeof series.itemStyle?.color === "string" && series.itemStyle.color) ||
        (typeof series.lineStyle?.color === "string" && series.lineStyle.color) ||
        undefined;
      series.smooth = series.smooth === undefined || series.smooth === false ? 0.35 : series.smooth;
      series.lineStyle = { ...(series.lineStyle ?? {}), width: compact ? 2 : 2.5, cap: "round" };
      series.symbol = series.symbol ?? "circle";
      if (series.showSymbol !== false) {
        series.itemStyle = { ...(series.itemStyle ?? {}), borderColor: surface, borderWidth: 2 };
        series.symbolSize = Math.max(Number(series.symbolSize) || 0, 7);
      }
      if (series.areaStyle && color && /^#/.test(color)) {
        const themed = themedColor(color, isDark);
        series.areaStyle = {
          ...series.areaStyle,
          opacity: 1,
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              // Only the lead series gets a real fill; the rest stay a faint wash.
              { offset: 0, color: withAlpha(themed, isPrimaryLine ? (isDark ? 0.32 : 0.22) : 0.05) },
              { offset: 1, color: withAlpha(themed, 0) },
            ],
          },
        };
      }
    }

    if (series.type === "pie") {
      const slices = Array.isArray(series.data) ? series.data.length : 0;
      const isDonut = Array.isArray(series.radius) && String(series.radius[0]) !== "0%" && String(series.radius[0]) !== "0";
      series.itemStyle = {
        ...(series.itemStyle ?? {}),
        borderColor: surface,
        borderWidth: 2,
        borderRadius: isDonut ? 8 : 6,
      };
      if (!compact) {
        series.emphasis = { scale: true, scaleSize: 6, ...(series.emphasis ?? {}) };
        if (slices > 6) {
          // Too many slices for readable outside labels: legend on the right instead.
          series.label = { show: false };
          series.labelLine = { show: false };
          series.center = ["34%", "50%"];
          series.top = 8;
          series.bottom = 8;
          series.radius = isDonut ? ["46%", "74%"] : ["0%", "74%"];
          option.legend = {
            show: true,
            type: "scroll",
            orient: "vertical",
            right: 8,
            top: "middle",
            height: "86%",
            icon: "circle",
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 10,
            textStyle: { color: muted, fontSize: 12, width: 120, overflow: "truncate" },
            pageIconColor: ink,
            pageIconInactiveColor: isDark ? "#48484a" : "#d2d2d7",
            pageIconSize: 10,
            pageTextStyle: { color: muted, fontSize: 11 },
          };
        } else {
          series.label = {
            ...(series.label ?? {}),
            show: true,
            position: "outside",
            color: ink,
            fontSize: 12,
            formatter: "{b|{b}}\n{d|{d}%}",
            rich: {
              b: { color: muted, fontSize: 11, lineHeight: 16, width: 110, overflow: "truncate" },
              d: { color: ink, fontSize: 13, fontWeight: 600, lineHeight: 18 },
            },
          };
          series.labelLine = { ...(series.labelLine ?? {}), lineStyle: { color: grid.replace(/0\.0\d\)/, "0.25)") } };
        }
      }
    }

    if (series.type === "scatter") {
      series.itemStyle = { ...(series.itemStyle ?? {}), opacity: series.itemStyle?.opacity ?? 0.85 };
    }

    if (series.type === "funnel") {
      series.itemStyle = { ...(series.itemStyle ?? {}), borderColor: surface, borderWidth: 2 };
      series.gap = series.gap ?? 4;
    }

    return series;
  });

  if (option.title && !compact) {
    option.title = asArray<AnyObj>(option.title).map((t) => ({
      ...t,
      textStyle: { ...(t?.textStyle ?? {}), color: ink, fontSize: 14, fontWeight: 600, fontFamily: FONT_STACK },
    }));
  }

  recolor(option.series, isDark);
  recolor(option.visualMap, isDark);
  option.color = isDark ? SERIES_PALETTE_DARK : SERIES_PALETTE_LIGHT;

  return option as EChartsOption;
}
