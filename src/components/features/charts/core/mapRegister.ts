import * as echarts from "echarts";

const WORLD_MAP_CDN =
  "https://cdn.jsdelivr.net/npm/echarts@6/map/json/world.json";

/**
 * Registers the ECharts `"world"` map. GeoJSON is loaded from CDN (not bundled in echarts npm v6).
 */
export async function ensureWorldMapRegistered(): Promise<void> {
  if (typeof echarts.getMap === "function" && echarts.getMap("world")) {
    return;
  }

  const res = await fetch(WORLD_MAP_CDN);
  if (!res.ok) {
    throw new Error(`World map GeoJSON request failed (${res.status})`);
  }
  const json = await res.json();
  echarts.registerMap("world", json);
}
