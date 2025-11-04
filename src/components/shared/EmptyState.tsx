/**
 * EmptyState Component
 * 
 * A reusable component for displaying empty states across the application.
 * Shows an icon, title, description, and optional action button.
 * 
 * @example
 * <EmptyState
 *   icon={<Database className="w-12 h-12" />}
 *   title="No databases connected"
 *   description="Connect your first database to start analyzing data"
 *   action={<Button onClick={handleConnect}>Connect Database</Button>}
 * />
 */

import { ReactNode } from 'react';

interface EmptyStateProps {
  /** Icon to display (Lucide React icon recommended) */
  icon: ReactNode;
  /** Main heading text */
  title: string;
  /** Descriptive text below title */
  description: string;
  /** Optional action button or element */
  action?: ReactNode;
  /** Optional additional CSS classes */
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}>
      {/* Icon container with gradient background */}
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 flex items-center justify-center mb-6 text-muted-foreground">
        {icon}
      </div>
      
      {/* Title */}
      <h3 className="text-foreground mb-2 text-center">
        {title}
      </h3>
      
      {/* Description */}
      <p className="text-muted-foreground text-center max-w-md mb-6">
        {description}
      </p>
      
      {/* Action button */}
      {action && <div>{action}</div>}
    </div>
  );
}
