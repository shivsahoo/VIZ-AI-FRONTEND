import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "./chartTypes";
import { composeCartesianOption } from "./cartesianShared";
import { composePieOption } from "./buildPieOption";
import { resolveSeriesKeys } from "./seriesKeys";

/**
 * Single entry: resolves axes keys, then delegates to pie vs cartesian composers.
 */
export function buildChartOption(props: ChartOptionBuildProps): EChartsOption {
  if (!props.data?.length) {
    return {};
  }

  const sample = props.data[0];
  let xKey = props.xAxisKey;
  if (sample && xKey && !(xKey in sample)) {
    const fallback = Object.keys(sample).find(
      (k) => typeof sample[k] !== "number",
    );
    xKey = fallback ?? xKey;
  }

  const seriesKeys = resolveSeriesKeys(props.data, xKey, props.dataKeys);
  if (props.type !== "pie" && seriesKeys.length === 0) {
    return {};
  }

  if (props.type === "pie") {
    return composePieOption(props, xKey, seriesKeys);
  }

  return composeCartesianOption(props, xKey, seriesKeys, props.type);
}

export { resolveSeriesKeys } from "./seriesKeys";
