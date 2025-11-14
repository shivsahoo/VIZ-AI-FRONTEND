export interface ChartDataConfig {
  data: any[];
  dataKeys: {
    primary: string;
    secondary?: string;
  };
  xAxisKey: string;
}

export const getDefaultChartDataConfig = (): ChartDataConfig => ({
  data: [],
  dataKeys: { primary: "value" },
  xAxisKey: "label",
});

export const inferChartDataConfig = (
  rawData: any[] | undefined,
  chartType: "line" | "bar" | "pie" | "area"
): ChartDataConfig => {
  if (!rawData || rawData.length === 0) {
    return getDefaultChartDataConfig();
  }

  const normalizedRows = rawData.map((row, index) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      return { ...row };
    }
    return {
      value: typeof row === "number" ? row : Number(row) || 0,
      label: `Row ${index + 1}`,
    };
  });

  const sample = normalizedRows[0];
  const keys = Object.keys(sample);

  if (keys.length === 0) {
    return getDefaultChartDataConfig();
  }

  const numericKeys = keys.filter(
    (key) =>
      typeof sample[key] === "number" ||
      (!isNaN(Number(sample[key])) &&
        sample[key] !== null &&
        sample[key] !== undefined)
  );

  let primaryKey = numericKeys[0] || keys[1] || keys[0];
  let secondaryKey = numericKeys.find((key) => key !== primaryKey);

  let potentialXAxisKey =
    keys.find(
      (key) => key !== primaryKey && typeof sample[key] !== "number"
    ) || keys.find((key) => key !== primaryKey);

  if (!potentialXAxisKey) {
    potentialXAxisKey = "index";
  }

  const data = normalizedRows.map((row, index) => {
    const coercedRow: Record<string, any> = { ...row };
    if (!(potentialXAxisKey in coercedRow)) {
      coercedRow[potentialXAxisKey] = index + 1;
    }

    coercedRow[primaryKey] =
      typeof row[primaryKey] === "number"
        ? row[primaryKey]
        : Number(row[primaryKey]) || 0;

    if (secondaryKey) {
      coercedRow[secondaryKey] =
        typeof row[secondaryKey] === "number"
          ? row[secondaryKey]
          : Number(row[secondaryKey]) || 0;
    }

    return coercedRow;
  });

  if (chartType === "pie") {
    const nameKey = potentialXAxisKey === "index" ? "label" : potentialXAxisKey;
    return {
      data: data.map((row, index) => ({
        name: row[nameKey] ?? row[potentialXAxisKey] ?? `Slice ${index + 1}`,
        value: row[primaryKey],
      })),
      dataKeys: { primary: "value" },
      xAxisKey: "name",
    };
  }

  // Sort data by x-axis key for line and area charts to ensure proper connections
  let sortedData = data;
  if (chartType === "line" || chartType === "area") {
    sortedData = [...data].sort((a, b) => {
      const aVal = a[potentialXAxisKey];
      const bVal = b[potentialXAxisKey];
      
      // Handle date strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return aDate - bDate;
        }
        // If not valid dates, do string comparison
        return aVal.localeCompare(bVal);
      }
      
      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      
      // Fallback to string comparison
      return String(aVal).localeCompare(String(bVal));
    });
  }

  return {
    data: sortedData,
    dataKeys: {
      primary: primaryKey,
      ...(secondaryKey ? { secondary: secondaryKey } : {}),
    },
    xAxisKey: potentialXAxisKey,
  };
};

