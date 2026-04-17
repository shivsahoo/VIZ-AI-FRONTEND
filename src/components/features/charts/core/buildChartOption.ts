import type { EChartsOption } from "echarts";

import type { ChartOptionBuildProps } from "./chartTypes";
import { composeCartesianOption } from "./cartesianShared";
import { composePieOption } from "./buildPieOption";
import { resolveSeriesKeys } from "./seriesKeys";

function isNumericValue(value: unknown): boolean {
  return (
    typeof value === "number" ||
    (value !== null && value !== undefined && value !== "" && !Number.isNaN(Number(value)))
  );
}

function buildSingleValueFallbackProps(
  props: ChartOptionBuildProps,
): ChartOptionBuildProps | null {
  if (!props.data || props.data.length !== 1) return null;
  const sample = props.data[0];
  if (!sample || typeof sample !== "object") return null;

  const keys = Object.keys(sample);
  const numericKeys = keys.filter((key) => isNumericValue(sample[key]));
  if (numericKeys.length !== 1 || keys.length > 2) return null;

  const valueKey = numericKeys[0];
  const labelKey = keys.find((key) => key !== valueKey);
  const label =
    labelKey && sample[labelKey] != null && sample[labelKey] !== ""
      ? String(sample[labelKey])
      : valueKey;

  return {
    ...props,
    data: [{ label, value: Number(sample[valueKey]) || 0 }],
    dataKeys:
      props.type === "pie" || props.type === "donut"
        ? ["value"]
        : ["value"],
    xAxisKey: "label",
  };
}

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
    const fallbackProps = buildSingleValueFallbackProps(props);
    if (!fallbackProps) {
      return {};
    }
    const fallbackSeriesKeys = resolveSeriesKeys(
      fallbackProps.data,
      fallbackProps.xAxisKey,
      fallbackProps.dataKeys,
    );
    return composeCartesianOption(
      fallbackProps,
      fallbackProps.xAxisKey,
      fallbackSeriesKeys,
      fallbackProps.type,
    );
  }

  if (props.type === "pie" || props.type === "donut") {
    return composePieOption(props, xKey, seriesKeys);
  }

  return composeCartesianOption(props, xKey, seriesKeys, props.type);
}

export { resolveSeriesKeys } from "./seriesKeys";
