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
): string {
  let entries = getTooltipExtraFieldEntries(row, seriesKeys);
  if (extraFieldKeys?.length) {
    const allow = new Set(extraFieldKeys);
    entries = entries.filter(([k]) => allow.has(k));
  }
  if (entries.length === 0) return "";
  const lines = entries.map(
    ([k, v]) =>
      `<div style="font-size:11px;color:#D1D5DB;margin:0">${k}: ${formatScalarForTooltip(v)}</div>`,
  );
  return `
    <div style="margin-top:6px;padding-top:6px;border-top:1px solid #4B5563;font-size:11px;color:#9CA3AF">Other fields</div>
    ${lines.join("")}
  `;
}
