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
 * Default color palette using CSS variables from design system
 */
const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))"
];

/**
 * Color palette specifically for pie chart segments
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
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />}
            <XAxis 
              dataKey={xAxisKey} 
              {...commonAxisStyle}
              type="category"
              allowDuplicatedCategory={false}
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
              cursor={{ stroke: colors[0], strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
            <Line
              type="monotone"
              dataKey={dataKeys.primary}
              stroke={colors[0]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: colors[0], strokeWidth: 2, stroke: '#fff' }}
              connectNulls={false}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            {dataKeys.secondary && (
              <Line
                type="monotone"
                dataKey={dataKeys.secondary}
                stroke={colors[1]}
                strokeWidth={2.5}
                strokeDasharray="8 4"
                dot={false}
                activeDot={{ r: 5, fill: colors[1], strokeWidth: 2, stroke: '#fff' }}
                connectNulls={false}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      );

    case 'bar':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />}
            <XAxis dataKey={xAxisKey} {...commonAxisStyle} />
            <YAxis {...commonAxisStyle} />
            <Tooltip content={<CustomChartTooltip />} />
            {showLegend && <Legend />}
            <Bar dataKey={dataKeys.primary} fill={colors[0]} radius={[8, 8, 0, 0]} />
            {dataKeys.secondary && (
              <Bar dataKey={dataKeys.secondary} fill={colors[1]} radius={[8, 8, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      );

    case 'pie':
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={Math.min(height * 0.35, 120)}
              fill="#8884d8"
              dataKey={dataKeys.primary}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      );

    case 'area':
      return (
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
              dataKey={xAxisKey} 
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
              cursor={{ stroke: colors[0], strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            {showLegend && <Legend wrapperStyle={{ paddingTop: '10px' }} />}
            <Area
              type="monotone"
              dataKey={dataKeys.primary}
              stroke={colors[0]}
              fill={`url(#gradient-${dataKeys.primary})`}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5, fill: colors[0], strokeWidth: 2, stroke: '#fff' }}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
            {dataKeys.secondary && (
              <Area
                type="monotone"
                dataKey={dataKeys.secondary}
                stroke={colors[1]}
                fill={`url(#gradient-${dataKeys.secondary})`}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: colors[1], strokeWidth: 2, stroke: '#fff' }}
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );

    default:
      return null;
  }
}
