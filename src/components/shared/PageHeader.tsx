/**
 * PageHeader Component
 * 
 * A reusable page header with title, description, and action buttons.
 * Provides consistent styling across all pages.
 * 
 * @example
 * <PageHeader
 *   title="Dashboards"
 *   description="Create and manage your data visualization dashboards"
 *   action={<Button onClick={handleCreate}>Create Dashboard</Button>}
 * />
 */

import { ReactNode } from 'react';
import React from "react";
interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional page description */
  description?: string;
  /** Optional action buttons or elements */
  action?: ReactNode;
  /** Optional breadcrumb or back navigation */
  breadcrumb?: ReactNode;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Displays a consistent page header with title, description, and actions
 */
export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      {/* Optional breadcrumb navigation */}
      {breadcrumb && <div className="mb-4">{breadcrumb}</div>}
      
      {/* Header content */}
      <div className="flex items-start justify-between gap-4">
        {/* Title and description */}
        <div className="flex-1">
          <h1 className="text-foreground mb-2">{title}</h1>
          {description && (
            <p className="text-muted-foreground max-w-3xl">{description}</p>
          )}
        </div>
        
        {/* Action buttons */}
        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
