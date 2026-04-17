function isNumericColumn(val: unknown): boolean {
  return (
    typeof val === "number" ||
    (val !== null && val !== undefined && val !== "" && !isNaN(Number(val)))
  );
}

/** Explicit keys first (validated), then other numeric keys in insertion order. */
export function resolveSeriesKeys(
  data: Record<string, any>[],
  xAxisKey: string,
  explicit: string[],
): string[] {
  const sample = data[0];
  if (!sample || typeof sample !== "object") {
    return explicit.filter(Boolean);
  }

  const keys: string[] = [];
  const seen = new Set<string>();

  for (const k of explicit) {
    if (!k || seen.has(k) || k === xAxisKey) continue;
    if (k in sample) {
      keys.push(k);
      seen.add(k);
    }
  }

  for (const key of Object.keys(sample)) {
    if (key === xAxisKey || seen.has(key)) continue;
    if (data.some((row) => row && typeof row === "object" && isNumericColumn(row[key]))) {
      keys.push(key);
      seen.add(key);
    }
  }

  return keys;
}
