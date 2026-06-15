const STORAGE_KEY_PREFIX = "vizai_embed_daterange";

export interface PersistedDateRange {
  start: string;
  end: string;   
}


function buildKey(tokenId: string, chartId: string): string {
  return `${STORAGE_KEY_PREFIX}__${tokenId}__${chartId}`;
}


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

  }
}


export function clearPersistedRange(tokenId: string, chartId: string): void {
  try {
    localStorage.removeItem(buildKey(tokenId, chartId));
  } catch {

  }
}
