import type { ChartAxisConfig, ChartType } from "../components/features/charts/core/chartTypes";

export interface ChartDataConfig {
  data: any[];
  dataKeys: {
    primary: string;
    secondary?: string;
  };
  xAxisKey: string;
}

/** Optional axis column names from execute-query metadata or saved chart config. */
export interface InferChartDataOptions {
  xAxisHint?: string | null;
  yAxisHint?: string | null;
}

export const getDefaultChartDataConfig = (): ChartDataConfig => ({
  data: [],
  dataKeys: { primary: "value" },
  xAxisKey: "label",
});

const STRICT_ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T\s]|$)/;

function looksLikeDate(value: unknown): boolean {
  return typeof value === "string" && STRICT_ISO_DATE_RE.test(value.trim());
}

function compareAxisValues(aVal: unknown, bVal: unknown): number {
  if (typeof aVal === "string" && typeof bVal === "string") {
    if (looksLikeDate(aVal) && looksLikeDate(bVal)) {
      return new Date(aVal).getTime() - new Date(bVal).getTime();
    }
    return aVal.localeCompare(bVal, undefined, { numeric: true });
  }

  if (typeof aVal === "number" && typeof bVal === "number") {
    return aVal - bVal;
  }

  return String(aVal).localeCompare(String(bVal), undefined, { numeric: true });
}

export const inferChartDataConfig = (
  rawData: any[] | undefined,
  chartType:
    | "line"
    | "bar"
    | "pie"
    | "donut"
    | "area"
    | "stackedlinechart"
    | "stackedhorizontalbar"
    | "clustering",
  options?: InferChartDataOptions
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

  if (normalizedRows.length === 1 && numericKeys.length === 1 && keys.length <= 2) {
    const valueKey = numericKeys[0];
    const labelKey = keys.find((key) => key !== valueKey);
    const singleLabel =
      labelKey && sample[labelKey] != null && sample[labelKey] !== ""
        ? String(sample[labelKey])
        : valueKey;

    return {
      data: [{ label: singleLabel, value: Number(sample[valueKey]) || 0 }],
      dataKeys: { primary: "value" },
      xAxisKey: "label",
    };
  }

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

  if (
    hasGroupingColumn &&
    (chartType === "line" ||
      chartType === "area" ||
      chartType === "bar" ||
      chartType === "stackedlinechart" ||
      chartType === "stackedhorizontalbar")
  ) {
    // Find the x-axis column (usually date/time related or first string column)
    xAxisColumn = stringKeys.find(key => {
      const val = sample[key];
      if (typeof val === 'string') {
        if (looksLikeDate(val)) {
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
      return compareAxisValues(aVal, bVal);
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

  const hintX = options?.xAxisHint?.trim();
  const hintY = options?.yAxisHint?.trim();
  if (hintY && keys.includes(hintY)) {
    primaryKey = hintY;
  }
  secondaryKey = numericKeys.find((key) => key !== primaryKey);
  if (hintX && keys.includes(hintX)) {
    potentialXAxisKey = hintX;
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

  if (chartType === "pie" || chartType === "donut") {
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
  if (chartType === "line" || chartType === "area" || chartType === "stackedlinechart") {
    sortedData = [...data].sort((a, b) => {
      const aVal = a[potentialXAxisKey];
      const bVal = b[potentialXAxisKey];
      return compareAxisValues(aVal, bVal);
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

/** Chart kinds that use `inferExtendedChartConfig` instead of `inferChartDataConfig`. */
export const EXTENDED_CHART_TYPES: ChartType[] = [
  "scatter",
  "clustering",
  "heatmap",
  "funnel",
  "map",
];

export function isExtendedChartType(
  t: string | undefined | null,
): t is ChartType {
  return !!t && EXTENDED_CHART_TYPES.includes(t as ChartType);
}

/** Map snake_case API `axis_config` into `ChartAxisConfig`. */
export function mapApiAxisConfigToChart(raw: unknown): ChartAxisConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    xAxisKey: (o.x_axis_key ?? o.xAxisKey) as string | undefined,
    yAxisKey: (o.y_axis_key ?? o.yAxisKey) as string | undefined,
    valueKey: (o.value_key ?? o.valueKey) as string | undefined,
    categoryKey: (o.category_key ?? o.categoryKey) as string | undefined,
    regionKey: (o.region_key ?? o.regionKey) as string | undefined,
    metricKey: (o.metric_key ?? o.metricKey) as string | undefined,
  };
}

export interface ExtendedChartInferResult {
  data: Record<string, any>[];
  dataKeys: string[];
  xAxisKey: string;
  axisConfig: ChartAxisConfig;
  /** When set, callers should render this type instead of the requested extended type (e.g. bar instead of scatter). */
  fallbackType?: ChartType;
}

/** Whether most sampled values in a column parse as finite numbers. */
function isNumeric(rows: Record<string, any>[], key: string): boolean {
  const sample = rows.slice(0, 10);
  if (sample.length === 0) return false;
  const ok = sample.filter((r) => {
    const v = r[key];
    return (
      typeof v === "number" ||
      (v !== null &&
        v !== undefined &&
        v !== "" &&
        !Number.isNaN(Number(v)))
    );
  }).length;
  return ok > sample.length * 0.7;
}

/**
 * Derives tabular series config for scatter, heatmap, funnel, and map.
 * For line/bar/area/pie delegates to `inferChartDataConfig` unchanged.
 */
export function inferExtendedChartConfig(
  rows: Record<string, any>[] | undefined,
  chartType: ChartType,
  axisConfig?: ChartAxisConfig,
  inferOptions?: InferChartDataOptions,
): ExtendedChartInferResult {
  if (!rows || rows.length === 0) {
    return {
      data: [],
      dataKeys: [],
      xAxisKey: "",
      axisConfig: axisConfig ?? {},
    };
  }

  const columns = Object.keys(rows[0]);

  switch (chartType) {
    case "scatter":
    case "clustering": {
      const allColumns = Object.keys(rows[0]);
      const numericCols = allColumns.filter((c) => isNumeric(rows, c));

      if (numericCols.length < 2) {
        const legacy = inferChartDataConfig(
          rows,
          "bar",
          inferOptions,
        );
        return {
          data: legacy.data,
          dataKeys: [
            legacy.dataKeys.primary,
            ...(legacy.dataKeys.secondary
              ? [legacy.dataKeys.secondary]
              : []),
          ],
          xAxisKey: legacy.xAxisKey,
          axisConfig: {
            ...axisConfig,
            xAxisKey: legacy.xAxisKey,
            yAxisKey: legacy.dataKeys.primary,
          },
          fallbackType: "bar",
        };
      }

      // Scatter/clustering must always use numeric axes.
      // If incoming axis hints are categorical (common in probe mode metadata),
      // ignore them and fall back to numeric columns from actual result rows.
      let xKey = axisConfig?.xAxisKey;
      if (!xKey || !numericCols.includes(xKey)) {
        xKey = numericCols[0];
      }
      let yKey = axisConfig?.yAxisKey;
      if (!yKey || !numericCols.includes(yKey) || yKey === xKey) {
        yKey =
          numericCols.find((c) => c !== xKey) ??
          numericCols[1];
      }

      const xDistinct = new Set(rows.map((r) => r[xKey])).size;
      const yDistinct = new Set(rows.map((r) => r[yKey])).size;

      if (yDistinct > xDistinct * 2) {
        const t = xKey;
        xKey = yKey;
        yKey = t;
      }

      const xD = new Set(rows.map((r) => r[xKey])).size;
      const yD = new Set(rows.map((r) => r[yKey])).size;

      if (xD <= 3 && yD <= 3) {
        const legacy = inferChartDataConfig(rows, "bar", {
          ...inferOptions,
          xAxisHint: xKey,
          yAxisHint: yKey,
        });
        return {
          data: legacy.data,
          dataKeys: [
            legacy.dataKeys.primary,
            ...(legacy.dataKeys.secondary
              ? [legacy.dataKeys.secondary]
              : []),
          ],
          xAxisKey: legacy.xAxisKey,
          axisConfig: {
            ...axisConfig,
            xAxisKey: legacy.xAxisKey,
            yAxisKey: legacy.dataKeys.primary,
          },
          fallbackType: "bar",
        };
      }

      return {
        data: rows,
        dataKeys: [yKey],
        xAxisKey: xKey,
        axisConfig: {
          ...axisConfig,
          xAxisKey: xKey,
          yAxisKey: yKey,
          categoryKey:
            axisConfig?.categoryKey ??
            allColumns.find(
              (c) => c !== xKey && c !== yKey && !numericCols.includes(c),
            ) ??
            undefined,
        },
      };
    }

    case "heatmap": {
      const categoricalColumns = columns.filter((c) => !isNumeric(rows, c));
      const numericColumns = columns.filter((c) => isNumeric(rows, c));
      const xKey =
        axisConfig?.xAxisKey ??
        categoricalColumns[0] ??
        columns[0];
      const yKey =
        axisConfig?.categoryKey ??
        categoricalColumns.find((c) => c !== xKey) ??
        columns.find((c) => c !== xKey && !numericColumns.includes(c)) ??
        columns[1] ??
        xKey;
      const valKey =
        axisConfig?.valueKey ??
        numericColumns.find((c) => c !== xKey && c !== yKey) ??
        numericColumns[0] ??
        columns[2] ??
        columns[0];

      if (
        !xKey ||
        !yKey ||
        !valKey ||
        xKey === yKey ||
        xKey === valKey ||
        yKey === valKey
      ) {
        return {
          data: [],
          dataKeys: [],
          xAxisKey: "",
          axisConfig: axisConfig ?? {},
          fallbackType: "bar",
        };
      }

      return {
        data: rows,
        dataKeys: [valKey],
        xAxisKey: xKey,
        axisConfig: {
          ...axisConfig,
          xAxisKey: xKey,
          categoryKey: yKey,
          valueKey: valKey,
        },
      };
    }

    case "funnel": {
      const labelKey = axisConfig?.xAxisKey ?? columns[0];
      const valKey =
        axisConfig?.valueKey ??
        columns.find((c) => isNumeric(rows, c)) ??
        columns[1] ??
        columns[0];
      return {
        data: rows,
        dataKeys: [valKey],
        xAxisKey: labelKey,
        axisConfig: { ...axisConfig, xAxisKey: labelKey, valueKey: valKey },
      };
    }

    case "map": {
      const regionKey = axisConfig?.regionKey ?? columns[0];
      const metricKey =
        axisConfig?.metricKey ??
        columns.find((c) => isNumeric(rows, c)) ??
        columns[1] ??
        columns[0];
      return {
        data: rows,
        dataKeys: [metricKey],
        xAxisKey: regionKey,
        axisConfig: { ...axisConfig, regionKey, metricKey },
      };
    }

    default: {
      const legacy = inferChartDataConfig(
        rows,
        chartType as
          | "line"
          | "bar"
          | "pie"
          | "donut"
          | "area"
          | "stackedlinechart"
          | "stackedhorizontalbar"
          | "clustering",
        inferOptions,
      );
      return {
        data: legacy.data,
        dataKeys: [
          legacy.dataKeys.primary,
          ...(legacy.dataKeys.secondary
            ? [legacy.dataKeys.secondary]
            : []),
        ],
        xAxisKey: legacy.xAxisKey,
        axisConfig: { ...axisConfig },
      };
    }
  }
}

/** Convert extended infer result into legacy `ChartDataConfig` shape for existing UI. */
export function extendedToChartDataConfig(
  ext: ExtendedChartInferResult,
): ChartDataConfig {
  const secondary = ext.dataKeys[1];
  return {
    data: ext.data,
    dataKeys: {
      primary: ext.dataKeys[0] ?? "value",
      ...(secondary ? { secondary } : {}),
    },
    xAxisKey: ext.xAxisKey,
  };
}

