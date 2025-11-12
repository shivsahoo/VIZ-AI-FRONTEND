/**
 * ViewModeToggle Component
 * 
 * A toggle component for switching between grid and list view modes.
 * Provides consistent styling and behavior across views.
 * 
 * @example
 * <ViewModeToggle 
 *   value={viewMode} 
 *   onChange={setViewMode}
 * />
 */

import { Grid3x3, List } from "lucide-react";
import { Button } from "../ui/button";

type ViewMode = 'grid' | 'list';

interface ViewModeToggleProps {
  /** Current view mode */
  value: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Toggle between grid and list view modes
 */
export function ViewModeToggle({ 
  value, 
  onChange, 
  className = '' 
}: ViewModeToggleProps) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <Button
        variant={value === 'grid' ? 'default' : 'outline'}
        size="icon"
        onClick={() => onChange('grid')}
        className={`h-9 w-9 ${value === 'grid' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
        aria-label="Grid view"
      >
        <Grid3x3 className="w-4 h-4" />
      </Button>
      <Button
        variant={value === 'list' ? 'default' : 'outline'}
        size="icon"
        onClick={() => onChange('list')}
        className={`h-9 w-9 ${value === 'list' ? 'bg-primary text-primary-foreground' : 'border-border'}`}
        aria-label="List view"
      >
        <List className="w-4 h-4" />
      </Button>
    </div>
  );
}

