import type { ChartType } from "../components/features/charts/core/chartTypes";

export interface EmbedChartMeta {
  id: string;
  title: string;
  chart_type: string;
  x_axis?: string | null;
  y_axis?: string | null;
  is_time_based?: boolean;
  date_column?: string | null;
}

export interface VizAiEmbedConfig {
  tokenId: string;
  apiBase: string;
  dashboardTitle: string;
  charts: EmbedChartMeta[];
  assetsBase: string;
  accessToken?: string;
  expiresIn?: number;
}

declare global {
  interface Window {
    __VIZAI_EMBED__?: VizAiEmbedConfig;
  }
}

export type EmbedTheme = "dark" | "light";

export interface DateRangeState {

  min: string;
  max: string;
  start: string;
  end: string;
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
  dateRange: DateRangeState | null;
  isRefetchingDateFilter: boolean;
}


export interface DashboardMetaResponse {
  dashboard_title: string;
  dashboard_id: string;
  charts: EmbedChartMeta[];
}


export interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
}


export interface DateRangeResponse {
  min_date: string | null;
  max_date: string | null;
  date_column: string | null;
  is_time_based: boolean;
}

