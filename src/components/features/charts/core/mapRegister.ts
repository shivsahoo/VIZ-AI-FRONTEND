import * as echarts from "echarts";
import worldGeoJson from "./world.json";

/**
 * Registers the ECharts `"world"` map. GeoJSON is loaded from CDN (not bundled in echarts npm v6).
 */
export async function ensureWorldMapRegistered(): Promise<void> {
  if (typeof echarts.getMap === "function" && echarts.getMap("world")) {
    return;
  }
  echarts.registerMap("world", worldGeoJson as never);
}
