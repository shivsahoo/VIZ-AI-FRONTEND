import type { EChartsOption } from "echarts";

import { buildChartOption } from "../core/buildChartOption";
import type { ChartOptionBuildProps } from "../core/chartTypes";

export function buildBarOption(props: ChartOptionBuildProps): EChartsOption {
  return buildChartOption({ ...props, type: "bar" });
}
