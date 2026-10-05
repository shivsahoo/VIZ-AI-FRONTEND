/**
 * Turns column keys into readable labels:
 *   occupancy_rate_pct → "Occupancy rate (%)", totalUnits → "Total units".
 * Labels that already look human (spaces, mixed case words) are left alone.
 */
const ACRONYMS = new Set(["id", "url", "kpi", "gla", "sku", "roi", "aov", "ytd", "mtd", "qtd", "usd", "sar", "api", "sql"]);

export function looksLikeKey(label: string): boolean {
  return /_/.test(label) || /^[a-z]+[A-Z]/.test(label) || /^[a-z0-9]+$/.test(label);
}

export function humanizeKey(label: string): string {
  if (!label || !looksLikeKey(label)) return label;
  let pct = false;
  const words = label
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
    .filter((w) => {
      if (w === "pct" || w === "percent" || w === "percentage") {
        pct = true;
        return false;
      }
      return true;
    })
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  if (words.length === 0) return label;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return `${words.join(" ")}${pct ? " (%)" : ""}`;
}

/** Percent-like metric names (rate, pct, share, ratio…). */
export function isPercentKey(label: string): boolean {
  return /(pct|percent|percentage|\brate\b|_rate|rate_|share|ratio|\(%\))/i.test(label);
}
