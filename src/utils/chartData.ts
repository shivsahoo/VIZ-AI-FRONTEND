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

  // Detect if we have a categorical grouping column (for multi-series charts)
  // This happens when we have: x-axis, category, value columns
  const stringKeys = keys.filter(
    (key) => typeof sample[key] === "string" || typeof sample[key] === "object"
  );
  
  // Check if we have a pattern like: date/month column, category column (user_type, status, etc.), and value column
  // This indicates we need to pivot the data
  const hasGroupingColumn = stringKeys.length >= 2 && numericKeys.length >= 1;
  let groupingColumn: string | null = null;
  let valueColumn: string | null = null;
  let xAxisColumn: string | null = null;

  if (hasGroupingColumn && (chartType === "line" || chartType === "area" || chartType === "bar")) {
    // Find the x-axis column (usually date/time related or first string column)
    xAxisColumn = stringKeys.find(key => {
      const val = sample[key];
      if (typeof val === 'string') {
        // Check if it's a date
        const date = new Date(val);
        if (!isNaN(date.getTime())) {
          return true;
        }
        // Or check if key name suggests it's a time/date column
        const keyLower = key.toLowerCase();
        return keyLower.includes('month') || keyLower.includes('date') || 
               keyLower.includes('time') || keyLower.includes('year') ||
               keyLower.includes('day') || keyLower.includes('week');
      }
      return false;
    }) || stringKeys[0];

    // Find the grouping column (category column like user_type, status, etc.)
    groupingColumn = stringKeys.find(key => 
      key !== xAxisColumn && 
      (key.toLowerCase().includes('type') || 
       key.toLowerCase().includes('category') ||
       key.toLowerCase().includes('status') ||
       key.toLowerCase().includes('group') ||
       key.toLowerCase().includes('name'))
    ) || (stringKeys.find(key => key !== xAxisColumn) || null);

    // Find the value column (numeric column)
    valueColumn = numericKeys[0] || null;
  }

  // If we detected a grouping pattern, pivot the data
  if (groupingColumn && valueColumn && xAxisColumn) {
    const groupedData = new Map<string, Record<string, any>>();
    const categories = new Set<string>();

    // Collect all unique categories
    normalizedRows.forEach(row => {
      const category = String(row[groupingColumn!] || 'Unknown');
      categories.add(category);
    });

    // Group by x-axis value
    normalizedRows.forEach(row => {
      const xValue = row[xAxisColumn!];
      const category = String(row[groupingColumn!] || 'Unknown');
      const value = typeof row[valueColumn!] === 'number' 
        ? row[valueColumn!] 
        : Number(row[valueColumn!]) || 0;

      const key = String(xValue);
      if (!groupedData.has(key)) {
        groupedData.set(key, { [xAxisColumn!]: xValue });
      }
      groupedData.get(key)![category] = value;
    });

    // Convert to array and sort
    const pivotedData = Array.from(groupedData.values());
    
    // Sort by x-axis
    pivotedData.sort((a, b) => {
      const aVal = a[xAxisColumn!];
      const bVal = b[xAxisColumn!];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const aDate = new Date(aVal).getTime();
        const bDate = new Date(bVal).getTime();
        if (!isNaN(aDate) && !isNaN(bDate)) {
          return aDate - bDate;
        }
        return aVal.localeCompare(bVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      
      return String(aVal).localeCompare(String(bVal));
    });

    // Use first category as primary, second as secondary if available
    const categoryArray = Array.from(categories);
    const primaryKey = categoryArray[0] || valueColumn;
    const secondaryKey = categoryArray.length > 1 ? categoryArray[1] : undefined;

    return {
      data: pivotedData,
      dataKeys: {
        primary: primaryKey,
        ...(secondaryKey ? { secondary: secondaryKey } : {}),
      },
      xAxisKey: xAxisColumn,
    };
  }

  // Original logic for non-grouped data
  let primaryKey = numericKeys[0] || keys[1] || keys[0];
  let secondaryKey = numericKeys.find((key) => key !== primaryKey);

  let potentialXAxisKey =
    keys.find(
      (key) => key !== primaryKey && typeof sample[key] !== "number"
    ) || keys.find((key) => key !== primaryKey);

  if (!potentialXAxisKey) {
    potentialXAxisKey = "index";
  }

  // Handle case where there are NO numeric columns at all
  // This happens when backend sends label/value but value is a string
  // We'll aggregate by counting occurrences of each category
  if (numericKeys.length === 0 && chartType === 'bar') {
    console.log('[chartData] No numeric columns found for bar chart, aggregating...');
    console.log('[chartData] String keys:', stringKeys);
    console.log('[chartData] Sample data:', sample);
    
    // Find the categorical column (usually "value" or last string column)
    const categoryKey = stringKeys.find(key => 
      key.toLowerCase().includes('value') || 
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('category') ||
      key.toLowerCase().includes('institute')
    ) || stringKeys[stringKeys.length - 1];
    
    console.log('[chartData] Category key selected:', categoryKey);
    
    if (categoryKey) {
      // Count occurrences of each category
      const counts = new Map<string, number>();
      normalizedRows.forEach(row => {
        const category = String(row[categoryKey] || 'Unknown');
        counts.set(category, (counts.get(category) || 0) + 1);
      });
      
      // Convert to chart data format
      const aggregatedData = Array.from(counts.entries()).map(([name, count]) => ({
        name,
        value: count
      }));
      
      console.log('[chartData] Aggregated data:', aggregatedData);
      
      return {
        data: aggregatedData,
        dataKeys: { primary: 'value' },
        xAxisKey: 'name',
      };
    }
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

