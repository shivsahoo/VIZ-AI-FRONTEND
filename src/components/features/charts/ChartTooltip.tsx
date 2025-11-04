import React from "react";

export const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div
      style={{
        backgroundColor: '#1F2937',
        border: '2px solid #374151',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '12px',
        color: '#F9FAFB',
      }}
    >
      {label && <p style={{ margin: 0, marginBottom: 4, fontWeight: 500 }}>{label}</p>}
      {payload.map((entry: any, index: number) => (
        <p key={index} style={{ margin: 0, color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
};
