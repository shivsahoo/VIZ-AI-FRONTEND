import {
  formatExtraFieldsBlock,
  formatTooltipValue,
} from "../ChartTooltip";
import type { ChartOptionBuildProps } from "./chartTypes";

type OtherBreakdownEntry = { name: string; value: number; percent: number };

export function formatPieTooltip(
  param: Record<string, unknown>,
  valueKey: string,
  extraFields: ChartOptionBuildProps["extraFields"],
  isDark = true,
): string {
  const dataItem = (param.data ?? {}) as Record<string, unknown>;
  const row = dataItem.__row as Record<string, unknown> | undefined;
  const breakdown = dataItem.__otherBreakdown as
    | OtherBreakdownEntry[]
    | undefined;

  const seriesSet = new Set([valueKey]);
  const pct =
    param.percent != null ? `${Number(param.percent).toFixed(1)}%` : "";
  const name = String(param.name ?? "");
  const val = formatTooltipValue(param.value as number | string, name, row);

  const bg = isDark ? "#1F2937" : "#ffffff";
  const border = isDark ? "#374151" : "#e5e7eb";
  const textColor = isDark ? "#F9FAFB" : "#111827";
  const subTextColor = isDark ? "#D1D5DB" : "#374151";
  const dividerColor = isDark ? "#4B5563" : "#e5e7eb";
  const headingColor = isDark ? "#9CA3AF" : "#6B7280";

  let html = `<div style="background-color:${bg};border:2px solid ${border};border-radius:8px;padding:8px 12px;font-size:12px;color:${textColor};max-width:320px;">`;
  html += `<p style="margin:0 0 4px;font-weight:500">${name}</p>`;
  html += `<p style="margin:0;color:${(param as { color?: string }).color ?? (isDark ? "#ccc" : "#555")}">${val}${pct ? ` (${pct})` : ""}</p>`;

  if (breakdown && breakdown.length > 0) {
    const MAX_ITEMS = 12;
    const visible = breakdown.slice(0, MAX_ITEMS);
    const overflow = breakdown.length - visible.length;
    const itemsHtml = visible
      .map(
        (b) =>
          `<div style="display:flex;justify-content:space-between;gap:8px;font-size:11px;color:${subTextColor};margin:0;line-height:1.45"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px">${b.name}</span><span style="color:${textColor};white-space:nowrap">${formatTooltipValue(b.value, b.name)} (${b.percent.toFixed(1)}%)</span></div>`,
      )
      .join("");
    const overflowLine =
      overflow > 0
        ? `<div style="font-size:11px;color:${headingColor};margin-top:2px;font-style:italic">+${overflow} more…</div>`
        : "";
    html += `
      <div style="margin-top:6px;padding-top:6px;border-top:1px solid ${dividerColor};font-size:11px;color:${headingColor}">Includes</div>
      <div style="max-height:180px;overflow:auto;margin-top:2px">${itemsHtml}${overflowLine}</div>
    `;
  } else {
    html += formatExtraFieldsBlock(row, seriesSet, extraFields);
  }

  html += `</div>`;
  return html;
}
