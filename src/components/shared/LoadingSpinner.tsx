/**
 * LoadingSpinner Component
 * 
 * A reusable loading spinner with multiple size variants.
 * Uses CSS animations for smooth rotation.
 * 
 * @example
 * <LoadingSpinner size="md" />
 * <LoadingSpinner size="lg" text="Loading data..." />
 */

import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  /** Size variant of the spinner */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional loading text to display below spinner */
  text?: string;
  /** Optional additional CSS classes */
  className?: string;
}

/** Size mapping for icon dimensions */
const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

/**
 * Displays an animated loading spinner
 */
export function LoadingSpinner({ size = 'md', text, className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      {/* Animated spinner icon */}
      <Loader2 className={`${sizeMap[size]} text-primary animate-spin`} />
      
      {/* Optional loading text */}
      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}
