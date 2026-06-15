import { useCallback, useEffect, useRef, useState } from "react";
import type { DateRangeResponse } from "./types";

export interface DateRangeBounds {
  minDate: string | null;
  maxDate: string | null;
  dateColumn: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseDateRangeOptions {
  apiBase: string;
  tokenId: string;
  chartId: string;
  enabled: boolean;
  getAuthHeaders: () => Record<string, string>;
}

const FETCH_TIMEOUT_MS = 10_000;

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<Response>((_, reject) => {
      window.setTimeout(
        () => reject(new Error("Date range request timeout")),
        timeoutMs,
      );
    }),
  ]);
}

export function useDateRange({
  apiBase,
  tokenId,
  chartId,
  enabled,
  getAuthHeaders,
}: UseDateRangeOptions): DateRangeBounds {
  const [state, setState] = useState<DateRangeBounds>({
    minDate: null,
    maxDate: null,
    dateColumn: null,
    isLoading: enabled,
    error: null,
  });

  const hasFetchedRef = useRef(false);

  const fetchRange = useCallback(async () => {
    if (!enabled || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const url = `${apiBase}/api/v1/embed/${tokenId}/data/${chartId}/date-range`;
      const response = await fetchWithTimeout(
        url,
        { headers: getAuthHeaders() },
        FETCH_TIMEOUT_MS,
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = (await response.json()) as DateRangeResponse;

      setState({
        minDate: payload.min_date ?? null,
        maxDate: payload.max_date ?? null,
        dateColumn: payload.date_column ?? null,
        isLoading: false,
        error: null,
      });

      console.log(
        `[EMBED] Date range loaded — chart ${chartId.slice(0, 8)}... ` +
          `min=${payload.min_date} max=${payload.max_date}`,
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Date range fetch failed";
      console.warn(
        `[EMBED] Date range fetch failed — chart ${chartId.slice(0, 8)}...:`,
        message,
      );
      setState((prev) => ({ ...prev, isLoading: false, error: message }));
    }
  }, [apiBase, tokenId, chartId, enabled, getAuthHeaders]);

  useEffect(() => {
    void fetchRange();
  }, [fetchRange]);

  return state;
}
