/**
 * GradientButton Component
 * 
 * A button component with gradient styling for primary actions.
 * Replaces the repeated pattern: className="bg-gradient-to-r from-primary to-accent..."
 * 
 * @example
 * <GradientButton onClick={handleCreate}>
 *   <Plus className="w-4 h-4 mr-2" />
 *   Create Dashboard
 * </GradientButton>
 */

import { Button } from "../ui/button";
import { type ReactNode } from "react";
import { type ComponentProps } from "react";

interface GradientButtonProps extends Omit<ComponentProps<typeof Button>, 'className'> {
  /** Button content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Gradient-styled button for primary actions
 */
export function GradientButton({ 
  children, 
  className = '',
  ...props 
}: GradientButtonProps) {
  return (
    <Button
      {...props}
      className={`bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white ${className}`}
    >
      {children}
    </Button>
  );
}

