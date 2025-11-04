/**
 * SearchInput Component
 * 
 * A reusable search input with icon and clear functionality.
 * Debounces input for performance optimization.
 * 
 * @example
 * <SearchInput
 *   placeholder="Search charts..."
 *   value={searchQuery}
 *   onChange={setSearchQuery}
 * />
 */

import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface SearchInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Current search value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Debounce delay in milliseconds */
  debounce?: number;
  /** Optional additional CSS classes */
  className?: string;
}

/**
 * Search input with debouncing and clear functionality
 */
export function SearchInput({
  placeholder = 'Search...',
  value,
  onChange,
  debounce = 0,
  className = '',
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Debounce effect
  useEffect(() => {
    if (debounce > 0) {
      const timer = setTimeout(() => {
        onChange(localValue);
      }, debounce);

      return () => clearTimeout(timer);
    } else {
      onChange(localValue);
    }
  }, [localValue, debounce, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  /** Clear search input */
  const handleClear = () => {
    setLocalValue('');
    onChange('');
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search icon */}
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      
      {/* Input field */}
      <Input
        type="text"
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-10 pr-10"
      />
      
      {/* Clear button */}
      {localValue && (
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
