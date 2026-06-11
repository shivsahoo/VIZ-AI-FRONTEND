import type { ChartType } from "../components/features/charts/core/chartTypes";

export interface EmbedChartMeta {
  id: string;
  title: string;
  chart_type: string;
  x_axis?: string | null;
  y_axis?: string | null;
  /** Set by the backend when the chart represents time-series data */
  is_time_based?: boolean;
  /** The column name used as the date axis (mirrors x_axis for time-based charts) */
  date_column?: string | null;
}

export interface VizAiEmbedConfig {
  tokenId: string;
  apiBase: string;
  dashboardTitle: string;
  charts: EmbedChartMeta[];
  assetsBase: string;
  /** Embed session JWT for data requests (30m, refreshed at ~25m) */
  accessToken?: string;
  /** JWT TTL in seconds */
  expiresIn?: number;
}

declare global {
  interface Window {
    __VIZAI_EMBED__?: VizAiEmbedConfig;
  }
}

export type EmbedTheme = "dark" | "light";

/**
 * Holds the date-picker state for a single time-based chart.
 * `min` / `max` are the hard bounds derived from the data;
 * `start` / `end` are the user's current selection.
 */
export interface DateRangeState {
  /** Earliest date in the dataset (ISO YYYY-MM-DD) */
  min: string;
  /** Latest date in the dataset (ISO YYYY-MM-DD) */
  max: string;
  /** User-selected start (ISO YYYY-MM-DD) */
  start: string;
  /** User-selected end (ISO YYYY-MM-DD) */
  end: string;
  /** True while the /date-range endpoint is in-flight */
  isLoading: boolean;
}

export interface EmbedChartState {
  meta: EmbedChartMeta;
  type: ChartType;
  xAxis?: string | null;
  yAxis?: string | null;
  rows: Record<string, unknown>[] | null;
  isLoading: boolean;
  error: string | null;
  /**
   * Present only when meta.is_time_based === true.
   * null while the date-range discovery request is still in-flight or if
   * the chart is not time-based.
   */
  dateRange: DateRangeState | null;
  /** True while a date-filtered re-fetch is in-flight (distinct from initial load) */
  isRefetchingDateFilter: boolean;
}

/** Response shape from the dashboard metadata endpoint */
export interface DashboardMetaResponse {
  dashboard_title: string;
  dashboard_id: string;
  charts: EmbedChartMeta[];
}

/** Response shape from the embed JWT refresh endpoint */
export interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
}

/** Response shape from the /date-range discovery endpoint */
export interface DateRangeResponse {
  min_date: string | null;
  max_date: string | null;
  date_column: string | null;
  is_time_based: boolean;
}

