"use client";

import * as React from "react";

import { cn } from "./utils";
import type { ChartConfig } from "../features/charts/core/chartTypes";
import { buildEChartsTheme } from "../features/charts/core/colorResolver";

export type { ChartConfig, ChartType } from "../features/charts/core/chartTypes";
export { buildEChartsTheme };

type ChartContainerProps = React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ReactNode;
};

/**
 * Wraps chart content, injects --color-<key> CSS variables for theme-aware coloring,
 * and provides a sized container for ECharts (echarts-for-react).
 */
function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ChartContainerProps) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <div
      data-slot="chart"
      data-chart={chartId}
      className={cn(
        "relative h-full w-full text-xs [&_.echarts-svg]:outline-none",
        className,
      )}
      {...props}
    >
      <ChartStyle id={chartId} config={config} />
      <div className="h-full w-full min-h-0 min-w-0">{children}</div>
    </div>
  );
}

const THEMES = { light: "", dark: ".dark" } as const;

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, item]) => item.color,
  );

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([_theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .filter(Boolean)
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  );
};

export { ChartContainer, ChartStyle };
