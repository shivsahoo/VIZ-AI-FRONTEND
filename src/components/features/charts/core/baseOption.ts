import type { EChartsOption } from "echarts";

export function withBaseOption(option: EChartsOption): EChartsOption {
  return {
    animation: true,
    backgroundColor: "transparent",
    textStyle: { fontFamily: "inherit" },
    ...option,
  };
}
