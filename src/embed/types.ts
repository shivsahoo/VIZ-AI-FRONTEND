import type { ChartType } from "../components/features/charts/core/chartTypes";

export interface EmbedChartMeta {
  id: string;
  title: string;
  chart_type: string;
  x_axis?: string | null;
  y_axis?: string | null;
  is_time_based?: boolean;
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

export interface EmbedChartState {
  meta: EmbedChartMeta;
  type: ChartType;
  xAxis?: string | null;
  yAxis?: string | null;
  rows: Record<string, unknown>[] | null;
  isLoading: boolean;
  error: string | null;
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
