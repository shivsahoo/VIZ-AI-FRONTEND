/**
 * StatCard Component
 * 
 * A reusable card component for displaying statistics and metrics.
 * Supports trend indicators, icons, and custom styling.
 * 
 * @example
 * <StatCard
 *   title="Total Revenue"
 *   value="$124,590"
 *   change="+12.5%"
 *   trend="up"
 *   icon={<DollarSign className="w-5 h-5" />}
 * />
 */

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '../ui/card';

interface StatCardProps {
  /** Card title/label */
  title: string;
  /** Main value to display */
  value: string | number;
  /** Optional change percentage or text */
  change?: string;
  /** Trend direction (shows arrow indicator) */
  trend?: 'up' | 'down' | 'neutral';
  /** Optional icon to display */
  icon?: ReactNode;
  /** Optional description text */
  description?: string;
  /** Optional click handler */
  onClick?: () => void;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Displays a metric card with optional trend and icon
 */
export function StatCard({
  title,
  value,
  change,
  trend,
  icon,
  description,
  onClick,
  className = '',
}: StatCardProps) {
  // Determine trend color
  const trendColor = trend === 'up' 
    ? 'text-green-500' 
    : trend === 'down' 
    ? 'text-red-500' 
    : 'text-muted-foreground';

  return (
    <Card
      className={`p-6 hover:shadow-lg transition-all ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {/* Header with title and icon */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl text-foreground">{value}</p>
        </div>
        
        {/* Optional icon */}
        {icon && (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </div>

      {/* Change indicator and description */}
      {(change || description) && (
        <div className="flex items-center gap-2">
          {/* Trend indicator */}
          {change && (
            <div className={`flex items-center gap-1 ${trendColor}`}>
              {trend === 'up' && <TrendingUp className="w-4 h-4" />}
              {trend === 'down' && <TrendingDown className="w-4 h-4" />}
              <span className="text-sm">{change}</span>
            </div>
          )}
          
          {/* Description */}
          {description && (
            <span className="text-sm text-muted-foreground">{description}</span>
          )}
        </div>
      )}
    </Card>
  );
}
