import {
  formatExtraFieldsBlock,
  formatTooltipValue,
} from "../ChartTooltip";
import type { ChartOptionBuildProps } from "./chartTypes";

export function formatPieTooltip(
  param: Record<string, unknown>,
  dataRows: Record<string, any>[],
  valueKey: string,
  extraFields: ChartOptionBuildProps["extraFields"],
  isDark = true,
): string {
  const dataIndex =
    typeof param.dataIndex === "number" ? param.dataIndex : 0;
  const row = dataRows[dataIndex] as Record<string, unknown> | undefined;
  const seriesSet = new Set([valueKey]);
  const pct =
    param.percent != null ? `${Number(param.percent).toFixed(1)}%` : "";
  const name = String(param.name ?? "");
  const val = formatTooltipValue(param.value as number | string, name, row);

  const bg = isDark ? "#1F2937" : "#ffffff";
  const border = isDark ? "#374151" : "#e5e7eb";
  const textColor = isDark ? "#F9FAFB" : "#111827";

  let html = `<div style="background-color:${bg};border:2px solid ${border};border-radius:8px;padding:8px 12px;font-size:12px;color:${textColor};max-width:280px;">`;
  html += `<p style="margin:0 0 4px;font-weight:500">${name}</p>`;
  html += `<p style="margin:0;color:${(param as { color?: string }).color ?? (isDark ? "#ccc" : "#555")}">${val}${pct ? ` (${pct})` : ""}</p>`;
  html += formatExtraFieldsBlock(row, seriesSet, extraFields);
  html += `</div>`;
  return html;
}
