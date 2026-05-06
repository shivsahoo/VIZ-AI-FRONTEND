import { ChartCard, type ChartCardProps } from "./ChartCard";
import type { ChartAxisConfig, ChartType } from "./core/chartTypes";

export interface MiniChartProps {
  type: ChartType;
  data: Record<string, any>[];
  dataKeys: string[];
  xAxisKey: string;
  height?: number;
  /** Override series colors (single-series mini charts use `colors[0]`). */
  colors?: string[];
  axisConfig?: ChartAxisConfig;
}

/**
 * Compact sparkline-style chart for dashboard cards (no legend, tooltip, or axis labels).
 */
export function MiniChart({
  type,
  data,
  dataKeys,
  xAxisKey,
  height = 80,
  colors,
  axisConfig,
}: MiniChartProps) {
  const props: ChartCardProps = {
    type,
    data,
    dataKeys,
    xAxisKey,
    axisConfig,
    height,
    compact: true,
    showGrid: false,
    showLegend: false,
    colors:
      colors ?? ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"],
  };

  return (
    <div className="h-full w-full bg-gradient-to-br from-muted/20 to-muted/5 overflow-hidden rounded-lg border border-border/40">
      <ChartCard {...props} />
    </div>
  );
}
