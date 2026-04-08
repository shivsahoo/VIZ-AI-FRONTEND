import React from "react";

function formatTooltipScalar(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? value.toLocaleString()
      : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
}

export const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const row = payload[0]?.payload as Record<string, unknown> | undefined;
  const seriesKeys = new Set(
    payload.map((p: any) => p.dataKey).filter((k: unknown): k is string => typeof k === "string")
  );

  const extraFields =
    row && typeof row === "object"
      ? Object.entries(row).filter(([key, val]) => {
          if (val === undefined) return false;
          if (key.startsWith("__")) return false;
          if (seriesKeys.has(key)) return false;
          if (typeof val === "object" && val !== null) return false;
          return true;
        })
      : [];

  return (
    <div
      style={{
        backgroundColor: "#1F2937",
        border: "2px solid #374151",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "12px",
        color: "#F9FAFB",
        maxWidth: 280,
      }}
    >
      {label !== undefined && label !== null && label !== "" && (
        <p style={{ margin: 0, marginBottom: 4, fontWeight: 500 }}>{String(label)}</p>
      )}
      {payload.map((entry: any, index: number) => (
        <p key={index} style={{ margin: 0, color: entry.color }}>
          {entry.name}: {formatTooltipScalar(entry.value)}
        </p>
      ))}
      {extraFields.length > 0 && (
        <>
          <div
            style={{
              marginTop: 6,
              marginBottom: 4,
              borderTop: "1px solid #4B5563",
              paddingTop: 6,
              fontSize: "11px",
              color: "#9CA3AF",
            }}
          >
            Other fields
          </div>
          {extraFields.map(([key, val]) => (
            <p key={key} style={{ margin: 0, color: "#D1D5DB", fontSize: "11px" }}>
              {key}: {formatTooltipScalar(val)}
            </p>
          ))}
        </>
      )}
    </div>
  );
};
