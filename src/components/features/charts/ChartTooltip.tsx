import { humanizeKey } from "./core/labels";

/**
 * Pure formatters for ECharts tooltips (parity with previous Recharts tooltip behavior).
 */

export function formatTooltipValue(
  value: number | string,
  _key: string,
  _rowContext?: Record<string, unknown>,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

function formatScalarForTooltip(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

/** Extra row fields to show under series lines (same filtering as legacy CustomChartTooltip). */
export function getTooltipExtraFieldEntries(
  row: Record<string, unknown> | undefined,
  seriesKeys: Set<string>,
): [string, unknown][] {
  if (!row || typeof row !== "object") return [];
  return Object.entries(row).filter(([key, val]) => {
    if (val === undefined) return false;
    if (key.startsWith("__")) return false;
    if (seriesKeys.has(key)) return false;
    if (typeof val === "object" && val !== null) return false;
    return true;
  });
}

export function formatExtraFieldsBlock(
  row: Record<string, unknown> | undefined,
  seriesKeys: Set<string>,
  extraFieldKeys?: string[],
  /** Values already shown in the tooltip (e.g. the category name) — not repeated. */
  skipValues?: Set<string>,
): string {
  let entries = getTooltipExtraFieldEntries(row, seriesKeys);
  if (extraFieldKeys?.length) {
    const allow = new Set(extraFieldKeys);
    entries = entries.filter(([k]) => allow.has(k));
  }
  if (skipValues?.size) {
    entries = entries.filter(([, v]) => !skipValues.has(String(v)));
  }
  if (entries.length === 0) return "";
  const shown = entries.slice(0, 6);
  // CSS variables resolve against <html>, so these follow the light/dark theme.
  const lines = shown.map(
    ([k, v]) =>
      `<div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;line-height:1.6"><span style="color:var(--muted-foreground)">${humanizeKey(k)}</span><span style="color:var(--foreground);font-weight:500">${formatScalarForTooltip(v)}</span></div>`,
  );
  const more = entries.length > shown.length
    ? `<div style="font-size:11px;color:var(--muted-foreground);margin-top:2px">+${entries.length - shown.length} more</div>`
    : "";
  return `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${lines.join("")}${more}</div>`;
}
