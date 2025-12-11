/**
 * ChartCard Component
 * 
 * Reusable chart visualization component using Recharts library.
 * Supports multiple chart types: line, bar, pie, and area charts.
 * 
 * @component
 * @example
 * ```tsx
 * <ChartCard
 *   type="line"
 *   data={chartData}
 *   height={300}
 *   dataKeys={{ primary: 'revenue', secondary: 'profit' }}
 *   xAxisKey="month"
 * />
 * ```
 */
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from "recharts";
import { CustomChartTooltip } from "./ChartTooltip";

/**
 * Props interface for ChartCard component
 */
interface ChartCardProps {
  /** Chart type to render */
  type: 'line' | 'bar' | 'pie' | 'area';
  /** Data array to visualize */
  data: any[];
  /** Chart height in pixels */
  height?: number;
  /** Data keys for primary and optional secondary series */
  dataKeys?: {
    primary: string;
    secondary?: string;
  };
  /** Key for X-axis data */
  xAxisKey?: string;
  /** Custom color array for chart elements */
  colors?: string[];
  /** Whether to show legend */
  showLegend?: boolean;
  /** Whether to show grid lines */
  showGrid?: boolean;
  /** Width of stroke/line in pixels */
  strokeWidth?: number;
}

/**
 * Default color palette - using purple as primary color to match design reference
 */
const DEFAULT_COLORS = [
  "#8B5CF6", // Purple - primary color
  "#6366F1", // Indigo - secondary color
  "#06B6D4", // Cyan - tertiary color
  "#F59E0B"  // Amber - quaternary color
];

/**
 * Color palette specifically for pie chart segments - matching reference design
 * Light blue, darker purple, lighter purple, amber, red
 */
const PIE_COLORS = ["#06B6D4", "#6366F1", "#8B5CF6", "#F59E0B", "#EF4444"];

/**
 * Renders a chart based on the specified type with consistent styling
 */
export function ChartCard({
  type,
  data,
  height = 300,
  dataKeys = { primary: 'value' },
  xAxisKey = 'name',
  colors = DEFAULT_COLORS,
  showLegend = true,
  showGrid = true,
  strokeWidth = 2
}: ChartCardProps) {
  
  // Validate data
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  // Track the x-axis key we're actually going to use so we can reference it while
  // we figure out the best data keys to plot. Needs to be declared up front because
  // some of the fallback logic below references it.
  let finalXAxisKey = xAxisKey;

  // Validate dataKeys exist in data
  const sampleData = data[0];
  if (!sampleData || typeof sampleData !== 'object') {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Invalid data format
      </div>
    );
  }

  // Check if primary dataKey exists
  let finalDataKeys = { ...dataKeys };
  if (!(dataKeys.primary in sampleData)) {
    console.warn(`ChartCard: Primary dataKey "${dataKeys.primary}" not found in data. Available keys:`, Object.keys(sampleData));
    // Try to find a numeric key as fallback
    const numericKey = Object.keys(sampleData).find(key => 
      typeof sampleData[key] === 'number' && key !== xAxisKey && key !== finalXAxisKey
    );
    if (numericKey) {
      finalDataKeys = { ...dataKeys, primary: numericKey };
      console.log(`ChartCard: Using fallback primary key: ${numericKey}`);
    } else {
      // Last resort: try to find any numeric value
      const anyNumericKey = Object.keys(sampleData).find(key => {
        const val = sampleData[key];
        return (typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== undefined)) 
          && key !== finalXAxisKey;
      });
      if (anyNumericKey) {
        finalDataKeys = { ...dataKeys, primary: anyNumericKey };
        console.log(`ChartCard: Using last resort numeric key: ${anyNumericKey}`);
      } else {
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Data key "{dataKeys.primary}" not found. Available: {Object.keys(sampleData).join(', ')}
          </div>
        );
      }
    }
  }

  // Check if xAxisKey exists
  if (xAxisKey && !(xAxisKey in sampleData)) {
    console.warn(`ChartCard: X-axis key "${xAxisKey}" not found in data. Available keys:`, Object.keys(sampleData));
    // Try to find a non-numeric key as fallback
    const stringKey = Object.keys(sampleData).find(key => 
      typeof sampleData[key] !== 'number' && key !== dataKeys.primary && key !== dataKeys.secondary
    );
    if (stringKey) {
      finalXAxisKey = stringKey;
    } else {
      // Last resort: use first key that's not the primary data key
      const fallbackKey = Object.keys(sampleData).find(key => key !== dataKeys.primary && key !== dataKeys.secondary);
      if (fallbackKey) {
        finalXAxisKey = fallbackKey;
      }
    }
  }
  
  /**
   * Common styling for X and Y axes across all chart types
   * Uses design system color tokens for consistency
   */
  const commonAxisStyle = {
    stroke: "hsl(var(--muted-foreground))",
    tick: { fill: "hsl(var(--muted-foreground))" }
  };

  // Render appropriate chart type based on props
  switch (type) {
    case 'line':
      // Check if x-axis values are dates
      const isDateAxis = data.length > 0 && finalXAxisKey && (() => {
        const sampleValue = data[0][finalXAxisKey];
        if (typeof sampleValue === 'string') {
          const date = new Date(sampleValue);
          return !isNaN(date.getTime());
        }
        return false;
      })();

      // If using a time scale, convert x-axis values to timestamps for Recharts
      const displayData = isDateAxis
        ? data.map((row) => {
            const value = row[finalXAxisKey];
            const ts = typeof value === 'string' ? new Date(value).getTime() : value;
            return { ...row, [finalXAxisKey]: ts };
          })
        : data;

      // Ensure we have valid data to render
      if (data.length === 0) {
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No data to display
          </div>
        );
      }

      // Calculate bottom margin based on whether we need space for rotated labels
      // For date axes with many points, we may need more space
      const dataPointCount = displayData.length;
      const needsRotatedLabels = isDateAxis && dataPointCount > 5;
      const lineBottomMargin = needsRotatedLabels ? 50 : 20;
      
      // Calculate minimum width for horizontal scrolling - allow comfortable spacing per data point
      const minChartWidth = Math.max(400, dataPointCount * 60);

      return (
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div style={{ minWidth: `${minChartWidth}px` }}>
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={displayData} margin={{ top: 10, right: 10, left: 10, bottom: lineBottomMargin }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />}
            <XAxis 
              dataKey={finalXAxisKey} 
              {...commonAxisStyle}
              type={isDateAxis ? "number" : "category"}
              scale={isDateAxis ? "time" : undefined}
              domain={isDateAxis ? ['dataMin', 'dataMax'] : undefined}
              tickFormatter={isDateAxis ? (value) => {
                try {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                } catch {
                  return String(value);
                }
              } : undefined}
              allowDuplicatedCategory={false}
              interval={isDateAxis ? (dataPointCount > 12 ? Math.floor(dataPointCount / 8) : 0) : 0}
              angle={needsRotatedLabels ? -45 : 0}
              textAnchor={needsRotatedLabels ? "end" : "middle"}
              height={needsRotatedLabels ? 50 : undefined}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              {...commonAxisStyle}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip 
              content={<CustomChartTooltip />}
              cursor={{ stroke: colors[0] || "#8B5CF6", strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
            {/* Render primary line */}
            <Line
              type="monotone"
              dataKey={finalDataKeys.primary}
              stroke={colors[0] || "#8B5CF6"}
              strokeWidth={strokeWidth}
              dot={false}
              activeDot={{ r: 6, fill: colors[0] || "#8B5CF6", strokeWidth: 2, stroke: '#fff' }}
              connectNulls={true}
              isAnimationActive={false}
              name={finalDataKeys.primary}
            />
            {/* Render secondary line if exists */}
            {finalDataKeys.secondary && finalDataKeys.secondary in sampleData && (
              <Line
                type="monotone"
                dataKey={finalDataKeys.secondary}
                stroke={colors[1] || "#6366F1"}
                strokeWidth={strokeWidth}
                strokeDasharray="8 4"
                dot={false}
                activeDot={{ r: 6, fill: colors[1] || "#6366F1", strokeWidth: 2, stroke: '#fff' }}
                connectNulls={true}
                isAnimationActive={false}
                name={finalDataKeys.secondary}
              />
            )}
            {/* Render additional series dynamically if they exist in data */}
            {displayData.length > 0 && (() => {
              const allKeys = Object.keys(sampleData);
              const numericKeys = allKeys.filter(key => {
                if (key === finalXAxisKey) return false;
                const val = sampleData[key];
                return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== undefined);
              });
              // Get all numeric keys that aren't already rendered
              const additionalKeys = numericKeys.filter(key => 
                key !== finalDataKeys.primary && 
                key !== finalDataKeys.secondary &&
                key in sampleData
              );
              
              return additionalKeys.map((key, index) => {
                const colorIndex = (index + 2) % colors.length;
                const isEven = (index + 2) % 2 === 0;
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[colorIndex] || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length]}
                    strokeWidth={strokeWidth}
                    strokeDasharray={isEven ? undefined : "8 4"}
                    dot={false}
                    activeDot={{ r: 6, fill: colors[colorIndex] || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length], strokeWidth: 2, stroke: '#fff' }}
                    connectNulls={true}
                    isAnimationActive={false}
                    name={key}
                  />
                );
              });
            })()}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'bar':
      // Calculate max value across all numeric keys to set proper Y-axis domain
      // This ensures bars are visible even with zero or small values
      const calculateMaxValue = () => {
        const allKeys = Object.keys(sampleData);
        const numericKeys = allKeys.filter(key => {
          if (key === finalXAxisKey) return false;
          const val = sampleData[key];
          return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== undefined);
        });
        
        let maxValue = 0;
        data.forEach(row => {
          numericKeys.forEach(key => {
            const val = typeof row[key] === 'number' ? row[key] : Number(row[key]);
            if (!isNaN(val) && val !== null && val !== undefined && val > maxValue) {
              maxValue = val;
            }
          });
        });
        
        // Ensure domain always starts at 0 for proper bar rendering
        // If all values are zero or empty, show a small range so bars are visible
        if (maxValue === 0 || maxValue === null || maxValue === undefined || isNaN(maxValue)) {
          return [0, 10];
        }
        // Add 10% padding at the top
        return [0, Math.ceil(maxValue * 1.1)];
      };
      
      const yAxisDomain = calculateMaxValue();
      
      // Check if we have any valid numeric values to render as bars
      const hasValidNumericData = () => {
        const allKeys = Object.keys(sampleData);
        const numericKeys = allKeys.filter(key => {
          if (key === finalXAxisKey) return false;
          const val = sampleData[key];
          return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== undefined);
        });
        
        if (numericKeys.length === 0) return false;
        
        // Check if any row has a valid numeric value
        return data.some(row => {
          return numericKeys.some(key => {
            const val = typeof row[key] === 'number' ? row[key] : Number(row[key]);
            return !isNaN(val) && val !== null && val !== undefined && val > 0;
          });
        });
      };
      
      const hasNumericData = hasValidNumericData();
      
      // Normalize data to handle null/undefined values - convert them to 0
      // If no valid numeric data exists, set a minimal value to show thin bars at bottom
      const normalizedBarData = data.map(row => {
        const normalizedRow = { ...row };
        Object.keys(normalizedRow).forEach(key => {
          if (key !== finalXAxisKey) {
            if (normalizedRow[key] === null || normalizedRow[key] === undefined) {
              normalizedRow[key] = hasNumericData ? 0 : 1;
            } else if (!hasNumericData) {
              // If no valid numeric data, convert string values to minimal numeric value
              const val = normalizedRow[key];
              if (typeof val !== 'number' || isNaN(val)) {
                normalizedRow[key] = 1;
              }
            }
          }
        });
        return normalizedRow;
      });
      
      // Adjust domain for non-numeric case - show minimal range for thin bars
      const finalDomain = hasNumericData ? yAxisDomain : [0, 2];
      
      // Smart label display based on number of bars
      const barCount = normalizedBarData.length;
      const shouldRotateLabels = barCount > 5;
      const bottomMargin = shouldRotateLabels ? 60 : 20;
      
      // Calculate minimum width for horizontal scrolling - allow comfortable spacing per bar
      const minBarChartWidth = Math.max(400, barCount * 80);
      
      return (
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div style={{ minWidth: `${minBarChartWidth}px` }}>
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={normalizedBarData} margin={{ top: 10, right: 10, left: 10, bottom: bottomMargin }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />}
            <XAxis 
              dataKey={finalXAxisKey} 
              {...commonAxisStyle}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              angle={shouldRotateLabels ? -45 : 0}
              textAnchor={shouldRotateLabels ? "end" : "middle"}
              height={shouldRotateLabels ? 60 : undefined}
            />
            <YAxis 
              {...commonAxisStyle}
              domain={finalDomain}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              allowDecimals={false}
              hide={!hasNumericData}
            />
            <Tooltip content={<CustomChartTooltip />} />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
            {/* Primary series */}
            <Bar 
              dataKey={finalDataKeys.primary} 
              fill={colors[0] || "#8B5CF6"} 
              radius={hasNumericData ? [8, 8, 0, 0] : [0, 0, 0, 0]}
              name={finalDataKeys.primary}
              opacity={hasNumericData ? 1 : 0.4}
              barSize={hasNumericData ? undefined : 2}
            />
            {/* Secondary if present */}
            {finalDataKeys.secondary && finalDataKeys.secondary in sampleData && (
              <Bar 
                dataKey={finalDataKeys.secondary} 
                fill={colors[1] || "#6366F1"} 
                radius={[8, 8, 0, 0]} 
                name={finalDataKeys.secondary}
              />
            )}
            {/* Additional numeric series */}
            {(() => {
              const allKeys = Object.keys(sampleData);
              const numericKeys = allKeys.filter(key => {
                if (key === finalXAxisKey) return false;
                const val = sampleData[key];
                return typeof val === 'number' || (!isNaN(Number(val)) && val !== null && val !== undefined);
              });
              const additionalKeys = numericKeys.filter(key => 
                key !== finalDataKeys.primary && key !== finalDataKeys.secondary && key in sampleData
              );
              return additionalKeys.map((key, index) => {
                const colorIndex = (index + 2) % colors.length;
                return (
                  <Bar 
                    key={key}
                    dataKey={key}
                    fill={colors[colorIndex] || DEFAULT_COLORS[colorIndex % DEFAULT_COLORS.length]}
                    radius={[8, 8, 0, 0]}
                    name={key}
                  />
                );
              });
            })()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    case 'pie':
      const outerRadius = Math.min(height * 0.3, 100);
      const innerRadius = outerRadius * 0.6; // Donut chart with 60% inner radius
      
      // For pie charts, determine the label key (nameKey) for Recharts
      // Check if "label" field exists in the data, otherwise use finalXAxisKey or first non-numeric key
      const pieLabelKey = (() => {
        if (sampleData && 'label' in sampleData) {
          return 'label';
        }
        // Try to find a key that looks like a label/name field
        const labelCandidates = ['label', 'name', 'category', 'status', 'type'];
        for (const candidate of labelCandidates) {
          if (candidate in sampleData && sampleData[candidate] !== null && sampleData[candidate] !== undefined) {
            return candidate;
          }
        }
        // Fall back to xAxisKey if it exists and is not the value key
        if (finalXAxisKey && finalXAxisKey !== finalDataKeys.primary) {
          return finalXAxisKey;
        }
        // Last resort: find first non-numeric key that's not the value key
        const nonNumericKeys = Object.keys(sampleData).filter(key => {
          if (key === finalDataKeys.primary) return false;
          const val = sampleData[key];
          return typeof val !== 'number' && isNaN(Number(val));
        });
        return nonNumericKeys[0] || 'name';
      })();
      
      return (
        <div className="flex flex-col w-full" style={{ height: `${height}px` }}>
          {/* Chart Area */}
          <div className="flex-shrink-0" style={{ height: `${height - 80}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={outerRadius}
                  innerRadius={innerRadius}
                  fill="#8884d8"
                  dataKey={finalDataKeys.primary}
                  nameKey={pieLabelKey}
                  paddingAngle={2}
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  content={<CustomChartTooltip />}
                  formatter={(value: any, name: any, props: any) => {
                    const labelText = props.payload[pieLabelKey] || props.payload.name || 'Unknown';
                    const percentage = props.payload.percent ? ((props.payload.percent * 100).toFixed(1)) : '0';
                    return [`${labelText}: ${value} (${percentage}%)`, ''];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Scrollable Legend Container - Fixed height with scroll */}
          <div className="flex-shrink-0 h-20 mt-2 overflow-y-auto overflow-x-hidden border-t border-border/50 pt-2">
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 items-center justify-center px-1">
              {data.map((entry: any, index: number) => {
                const labelText = entry[pieLabelKey] || entry.name || 'Unknown';
                const color = PIE_COLORS[index % PIE_COLORS.length];
                return (
                  <div
                    key={`legend-item-${index}`}
                    className="flex items-center gap-1.5 text-xs shrink-0"
                    style={{ color: 'hsl(var(--muted-foreground))' }}
                  >
                    <div
                      className="h-2.5 w-2.5 shrink-0 rounded-sm ml-2"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[11px] whitespace-nowrap">{labelText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

    case 'area':
      // Calculate minimum width for horizontal scrolling - allow comfortable spacing per data point
      const areaDataPointCount = data.length;
      const minAreaChartWidth = Math.max(400, areaDataPointCount * 60);
      
      return (
        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div style={{ minWidth: `${minAreaChartWidth}px` }}>
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id={`gradient-${dataKeys.primary}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[0]} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={colors[0]} stopOpacity={0.05}/>
              </linearGradient>
              {dataKeys.secondary && (
                <linearGradient id={`gradient-${dataKeys.secondary}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[1]} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={colors[1]} stopOpacity={0.02}/>
                </linearGradient>
              )}
            </defs>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />}
            <XAxis 
              dataKey={finalXAxisKey} 
              {...commonAxisStyle}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              {...commonAxisStyle}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <Tooltip 
              content={<CustomChartTooltip />}
              cursor={{ stroke: colors[0] || "#8B5CF6", strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
            <Area
              type="monotone"
              dataKey={finalDataKeys.primary}
              stroke={colors[0] || "#8B5CF6"}
              fill={`url(#gradient-${finalDataKeys.primary})`}
              strokeWidth={strokeWidth}
              dot={false}
              activeDot={{ r: 6, fill: colors[0] || "#8B5CF6", strokeWidth: 2, stroke: '#fff' }}
              connectNulls={true}
              isAnimationActive={false}
              name={finalDataKeys.primary}
            />
            {finalDataKeys.secondary && finalDataKeys.secondary in sampleData && (
              <Area
                type="monotone"
                dataKey={finalDataKeys.secondary}
                stroke={colors[1] || "#8B5CF6"}
                fill={`url(#gradient-${finalDataKeys.secondary})`}
                strokeWidth={strokeWidth}
                dot={false}
                activeDot={{ r: 6, fill: colors[1] || "#8B5CF6", strokeWidth: 2, stroke: '#fff' }}
                connectNulls={true}
                isAnimationActive={false}
                name={finalDataKeys.secondary}
              />
            )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );

    default:
      return null;
  }
}
