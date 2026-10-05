/**
 * Chart palette (Apple-style: Action Blue first, then ink, light blue, navy…).
 * Renderers use the light palette; `applyChartTheme` swaps each entry for its
 * dark-mode counterpart at the same index so series keep their identity.
 */
export const SERIES_PALETTE_LIGHT = [
  "#0071e3", // action blue
  "#1d1d1f", // ink
  "#7fb3ff", // light blue
  "#1e40af", // navy
  "#30b0c7", // teal
  "#ff9f0a", // orange
  "#5e5ce6", // indigo
  "#a1a1a6", // gray
  "#34c759", // green
  "#ff375f", // pink
];

export const SERIES_PALETTE_DARK = [
  "#2997ff",
  "#f5f5f7",
  "#8ec1ff",
  "#5b8def",
  "#64d2ff",
  "#ff9f0a",
  "#7d7aff",
  "#8e8e93",
  "#30d158",
  "#ff375f",
];

export const DEFAULT_SERIES_COLORS = SERIES_PALETTE_LIGHT;

export const PIE_SEGMENT_COLORS = SERIES_PALETTE_LIGHT;
