import type { EChartsOption } from "echarts";

export function buildAxisTooltipShell(
  formatter: (params: unknown) => string,
  isDark = true,
): EChartsOption["tooltip"] {
  const bg = isDark ? "rgba(20, 20, 30, 0.92)" : "rgba(255,255,255,0.96)";
  const border = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.12)";
  const textColor = isDark ? "#fff" : "#111827";
  const shadowColor = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";

  return {
    trigger: "axis",
    renderMode: "html",
    appendToBody: true,
    confine: false,
    backgroundColor: bg,
    borderColor: border,
    borderWidth: 1,
    textStyle: { color: textColor, fontSize: 12, fontFamily: "inherit" },
    extraCssText: "max-width: 360px; white-space: normal; z-index: 9999;",
    axisPointer: {
      type: "shadow",
      shadowStyle: { color: shadowColor },
    },
    formatter,
  };
}
