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
): string {
  const dataIndex =
    typeof param.dataIndex === "number" ? param.dataIndex : 0;
  const row = dataRows[dataIndex] as Record<string, unknown> | undefined;
  const seriesSet = new Set([valueKey]);
  const pct =
    param.percent != null ? `${Number(param.percent).toFixed(1)}%` : "";
  const name = String(param.name ?? "");
  const val = formatTooltipValue(param.value as number | string, name, row);

  let html = `<div style="background-color:#1F2937;border:2px solid #374151;border-radius:8px;padding:8px 12px;font-size:12px;color:#F9FAFB;max-width:280px;">`;
  html += `<p style="margin:0 0 4px;font-weight:500">${name}</p>`;
  html += `<p style="margin:0;color:${(param as { color?: string }).color ?? "#ccc"}">${val}${pct ? ` (${pct})` : ""}</p>`;
  html += formatExtraFieldsBlock(row, seriesSet, extraFields);
  html += `</div>`;
  return html;
}
