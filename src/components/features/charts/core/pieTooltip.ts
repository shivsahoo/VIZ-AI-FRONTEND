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

  const bg = isDark ? "rgba(44,44,46,0.96)" : "rgba(255,255,255,0.97)";
  const border = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const textColor = isDark ? "#f5f5f7" : "#1d1d1f";
  const subTextColor = isDark ? "#d1d1d6" : "#3a3a3c";
  const dividerColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const headingColor = isDark ? "#a1a1a6" : "#6e6e73";

  let html = `<div style="background-color:${bg};border:1px solid ${border};border-radius:12px;padding:10px 14px;box-shadow:0 10px 30px rgba(0,0,0,${isDark ? 0.45 : 0.12});backdrop-filter:blur(20px);font-size:12px;color:${textColor};max-width:320px;">`;
  html += `<p style="margin:0 0 4px;font-weight:600">${name}</p>`;
  const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${(param as { color?: string }).color ?? "#999"};margin-right:6px"></span>`;
  html += `<p style="margin:0;color:${textColor}">${dot}<b>${val}</b>${pct ? ` <span style="color:${headingColor}">· ${pct}</span>` : ""}</p>`;

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
    html += formatExtraFieldsBlock(row, seriesSet, extraFields, new Set([name]));
  }

  html += `</div>`;
  return html;
}
