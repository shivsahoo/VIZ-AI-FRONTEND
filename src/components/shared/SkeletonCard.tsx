/**
 * SkeletonCard Component
 * 
 * A reusable skeleton loading component for cards.
 * Provides consistent loading states across the application.
 * 
 * @example
 * <SkeletonCard variant="chart" />
 * <SkeletonCard variant="dashboard" />
 * <SkeletonGrid count={6} variant="chart" />
 */

import { Card } from "../ui/card";

interface SkeletonCardProps {
  /** Variant of skeleton card */
  variant?: 'chart' | 'dashboard' | 'default';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Individual skeleton card component
 */
export function SkeletonCard({ variant = 'default', className = '' }: SkeletonCardProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case 'chart':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted/50 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
              </div>
            </div>
            <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
          </div>
        );
      case 'dashboard':
        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted/50 animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-muted/50 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-muted/30 rounded animate-pulse w-full" />
                <div className="h-4 bg-muted/30 rounded animate-pulse w-2/3" />
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <div className="h-4 bg-muted/30 rounded animate-pulse w-1/2" />
            </div>
            <div className="h-4 bg-muted/30 rounded animate-pulse w-1/3" />
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <div className="h-4 bg-muted/50 rounded animate-pulse w-3/4" />
            <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
            <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />
          </div>
        );
    }
  };

  return (
    <Card className={`p-6 border-2 border-border ${className}`}>
      {getVariantClasses()}
    </Card>
  );
}

interface SkeletonGridProps {
  /** Number of skeleton cards to display */
  count?: number;
  /** Variant of skeleton cards */
  variant?: 'chart' | 'dashboard' | 'default';
  /** Grid columns configuration */
  columns?: {
    default?: number;
    md?: number;
    lg?: number;
  };
  /** Additional CSS classes */
  className?: string;
}

/**
 * Grid of skeleton cards for loading states
 */
export function SkeletonGrid({ 
  count = 6, 
  variant = 'default',
  columns = { default: 1, md: 2, lg: 3 },
  className = ''
}: SkeletonGridProps) {
  const gridCols = `grid-cols-${columns.default} md:grid-cols-${columns.md} lg:grid-cols-${columns.lg}`;
  
  return (
    <div className={`grid ${gridCols} gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} variant={variant} />
      ))}
    </div>
  );
}

