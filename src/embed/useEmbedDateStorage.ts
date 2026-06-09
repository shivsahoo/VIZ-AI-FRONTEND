/**
 * useEmbedDateStorage
 *
 * Persists and restores the user's date-range selection for each embedded
 * chart across page refreshes using browser localStorage.
 *
 * Key design decisions:
 *  - Storage key is namespaced by `tokenId` + `chartId` so multiple embedded
 *    dashboards on the same origin never collide.
 *  - Reads happen synchronously at call time (not inside an effect) so the
 *    initial value is available on the very first render.
 *  - Writes are fire-and-forget; localStorage errors (e.g. private-browsing
 *    quota exceeded) are silently swallowed so the rest of the app keeps
 *    working even if persistence fails.
 *  - Provides a `clearPersistedRange` helper so callers can wipe a single
 *    chart's entry (e.g. when the user clicks "Reset to full range").
 */

const STORAGE_KEY_PREFIX = "vizai_embed_daterange";

/** Shape stored in localStorage for a single chart */
export interface PersistedDateRange {
  start: string; // ISO YYYY-MM-DD
  end: string;   // ISO YYYY-MM-DD
}

/** Build the namespaced localStorage key for a chart. */
function buildKey(tokenId: string, chartId: string): string {
  return `${STORAGE_KEY_PREFIX}__${tokenId}__${chartId}`;
}

/**
 * Read a previously persisted date range for a chart.
 * Returns `null` when nothing has been stored yet (or storage is unavailable).
 */
export function readPersistedRange(
  tokenId: string,
  chartId: string,
): PersistedDateRange | null {
  try {
    const raw = localStorage.getItem(buildKey(tokenId, chartId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "start" in parsed &&
      "end" in parsed &&
      typeof (parsed as Record<string, unknown>).start === "string" &&
      typeof (parsed as Record<string, unknown>).end === "string"
    ) {
      return parsed as PersistedDateRange;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Persist the user's date-range selection for a chart.
 * Silently ignores storage errors (quota exceeded, private browsing, etc.).
 */
export function persistDateRange(
  tokenId: string,
  chartId: string,
  start: string,
  end: string,
): void {
  try {
    const payload: PersistedDateRange = { start, end };
    localStorage.setItem(buildKey(tokenId, chartId), JSON.stringify(payload));
  } catch {
    // Storage unavailable — carry on without persistence
  }
}

/**
 * Remove the persisted date range for a specific chart (e.g. on "Reset").
 */
export function clearPersistedRange(tokenId: string, chartId: string): void {
  try {
    localStorage.removeItem(buildKey(tokenId, chartId));
  } catch {
    // Ignore
  }
}
