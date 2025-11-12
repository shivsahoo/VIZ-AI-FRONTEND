/**
 * ActionButtonGroup Component
 * 
 * A group of action buttons that appear on hover (typically used in cards).
 * Provides consistent styling and hover behavior for action buttons.
 * 
 * @example
 * <ActionButtonGroup
 *   actions={[
 *     { icon: <Edit />, onClick: handleEdit, label: "Edit" },
 *     { icon: <Trash />, onClick: handleDelete, label: "Delete", variant: "destructive" }
 *   ]}
 * />
 */

import { Button, type buttonVariants } from "../ui/button";
import { type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";

type ButtonVariant = VariantProps<typeof buttonVariants>['variant'];

interface Action {
  /** Icon element */
  icon: ReactNode;
  /** Click handler */
  onClick: (e?: React.MouseEvent) => void;
  /** Button label for accessibility */
  label: string;
  /** Button variant */
  variant?: ButtonVariant;
  /** Additional CSS classes */
  className?: string;
}

interface ActionButtonGroupProps {
  /** Array of action buttons */
  actions: Action[];
  /** Show buttons always (default: false, shows on hover) */
  alwaysVisible?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Group of action buttons with hover visibility
 */
export function ActionButtonGroup({ 
  actions, 
  alwaysVisible = false,
  className = ''
}: ActionButtonGroupProps) {
  return (
    <div className={`flex items-center gap-0.5 flex-shrink-0 ${className}`}>
      {actions.map((action, index) => (
        <Button
          key={index}
          variant={action.variant || 'ghost'}
          size="icon"
          onClick={action.onClick}
          className={`h-7 w-7 text-muted-foreground hover:text-primary ${
            alwaysVisible 
              ? 'opacity-100' 
              : 'opacity-0 group-hover:opacity-100'
          } transition-opacity ${action.className || ''}`}
          aria-label={action.label}
          title={action.label}
        >
          <span className="w-3.5 h-3.5">{action.icon}</span>
        </Button>
      ))}
    </div>
  );
}

