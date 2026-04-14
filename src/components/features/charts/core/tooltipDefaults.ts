import type { EChartsOption } from "echarts";

export function buildAxisTooltipShell(
  formatter: (params: unknown) => string,
): EChartsOption["tooltip"] {
  return {
    trigger: "axis",
    backgroundColor: "rgba(20, 20, 30, 0.92)",
    borderColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    textStyle: { color: "#fff", fontSize: 12, fontFamily: "inherit" },
    axisPointer: {
      type: "shadow",
      shadowStyle: { color: "rgba(255,255,255,0.04)" },
    },
    formatter,
  };
}
