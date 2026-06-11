import type { EChartsOption } from "echarts";

import { buildChartOption } from "../core/buildChartOption";
import type { ChartOptionBuildProps } from "../core/chartTypes";

export function buildPieOption(props: ChartOptionBuildProps): EChartsOption {
  return buildChartOption(props);
}
