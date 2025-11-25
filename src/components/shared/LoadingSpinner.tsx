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

import React from "react";
import loaderGif from "@/assets/Trail loading.gif";

type LoaderSize = 'sm' | 'md' | 'lg' | 'xl';

interface GifLoaderProps {
  /** Predefined size token for the loader */
  size?: LoaderSize;
  /** Optional CSS classes for layout tweaks (margins, shadows, etc.) */
  className?: string;
  /** Accessible text for screen readers */
  label?: string;
  /** If true, hides the loader from screen readers */
  decorative?: boolean;
}

interface LoadingSpinnerProps extends Omit<GifLoaderProps, 'className' | 'decorative'> {
  /** Optional loading text to display below spinner */
  text?: string;
  /** Optional additional CSS classes */
  className?: string;
}

/** Pixel dimensions for GIF variants */
const sizeToPixels: Record<LoaderSize, number> = {
  sm: 64,
  md: 96,
  lg: 128,
  xl: 160,
};

/**
 * GIF-based loader that can be dropped inline anywhere in the UI.
 */
export function GifLoader({
  size = 'md',
  className = '',
  label = 'Loading',
  decorative = false,
}: GifLoaderProps) {
  const dimension = sizeToPixels[size] ?? sizeToPixels.md;

  return (
    <img
      src={loaderGif}
      width={dimension}
      height={dimension}
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      alt={decorative ? '' : label}
      className={`select-none ${className}`}
    />
  );
}

/**
 * Displays an animated loading spinner with optional helper text.
 */
export function LoadingSpinner({
  size = 'md',
  text,
  className = '',
  label = 'Loading data',
}: LoadingSpinnerProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <GifLoader size={size} decorative />

      {text && (
        <p className="text-sm text-muted-foreground">{text}</p>
      )}
    </div>
  );
}
