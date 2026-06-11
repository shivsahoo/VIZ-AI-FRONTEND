const STRICT_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/;

export function resolvePieNameKey(
  sample: Record<string, any>,
  xAxisKey: string,
  valueKey: string,
): string {
  const candidates = ["label", "name", "category", "status", "type"];
  for (const c of candidates) {
    if (c in sample && sample[c] != null && sample[c] !== undefined) {
      return c;
    }
  }
  if (xAxisKey && xAxisKey !== valueKey && xAxisKey in sample) {
    return xAxisKey;
  }
  const nonNumeric = Object.keys(sample).filter((k) => {
    if (k === valueKey) return false;
    const v = sample[k];
    return typeof v !== "number" && (v == null || isNaN(Number(v)));
  });
  return nonNumeric[0] || "name";
}

export function isDateStringSample(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return STRICT_ISO_DATE_RE.test(v.trim());
}
