/**
 * StatusBadge Component
 * 
 * A reusable status badge component with automatic styling and icons.
 * Handles common status types with consistent colors and icons.
 * 
 * @example
 * <StatusBadge status="connected" />
 * <StatusBadge status="draft" />
 * <StatusBadge status="published" />
 * <StatusBadge status="error" />
 */

import { Badge } from "../ui/badge";
import { Check, X, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

type StatusType = 
  | 'connected' 
  | 'disconnected' 
  | 'draft' 
  | 'published' 
  | 'pending'
  | 'error'
  | 'success'
  | 'warning';

interface StatusBadgeProps {
  /** Status type */
  status: StatusType;
  /** Custom label (defaults to status capitalized) */
  label?: string;
  /** Show icon */
  showIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status badge with automatic styling and icons
 */
export function StatusBadge({ 
  status, 
  label,
  showIcon = true,
  className = ''
}: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
      case 'success':
        return {
          icon: <Check className="w-3 h-3" />,
          className: 'bg-success/10 text-success border-success/20',
          label: label || 'Connected'
        };
      case 'disconnected':
      case 'error':
        return {
          icon: <X className="w-3 h-3" />,
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          label: label || 'Disconnected'
        };
      case 'draft':
      case 'pending':
        return {
          icon: <Clock className="w-3 h-3" />,
          className: 'bg-warning/10 text-warning border-warning/20',
          label: label || 'Draft'
        };
      case 'published':
        return {
          icon: <CheckCircle2 className="w-3 h-3" />,
          className: 'bg-success/10 text-success border-success/20',
          label: label || 'Published'
        };
      case 'warning':
        return {
          icon: <AlertCircle className="w-3 h-3" />,
          className: 'bg-warning/10 text-warning border-warning/20',
          label: label || 'Warning'
        };
      default:
        return {
          icon: null,
          className: 'bg-muted text-muted-foreground border-border',
          label: label || status
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge 
      variant="outline"
      className={`text-xs ${config.className} ${className}`}
    >
      {showIcon && config.icon && (
        <span className="mr-1">{config.icon}</span>
      )}
      {config.label}
    </Badge>
  );
}

