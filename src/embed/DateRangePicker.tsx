/*
 * DateRangePicker
 *
 * A fully theme-aware date range picker for the VizAI embed layer.
 * Uses native <input type="date"> elements
 
 */

import { useCallback, useEffect, useState } from "react";

export interface DateRangePickerProps {
 
  minDate: string;
  maxDate: string;
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
  isLoading?: boolean;
  id: string;
}

export function DateRangePicker({
  minDate,
  maxDate,
  startDate,
  endDate,
  onChange,
  isLoading = false,
  id,
}: DateRangePickerProps) {

  const [localStart, setLocalStart] = useState(startDate);
  const [localEnd, setLocalEnd]   = useState(endDate);
  const [validationError, setValidationError] = useState<string | null>(null);


  useEffect(() => { setLocalStart(startDate); }, [startDate]);
  useEffect(() => { setLocalEnd(endDate); },   [endDate]);

  const validate = useCallback(
    (start: string, end: string): boolean => {
      if (!start || !end) return false;
      if (start > end) {
        setValidationError("Start date must be on or before the end date.");
        return false;
      }
      setValidationError(null);
      return true;
    },
    [],
  );

  const handleCommit = useCallback(
    (nextStart: string, nextEnd: string) => {
      if (validate(nextStart, nextEnd)) {
        onChange(nextStart, nextEnd);
      }
    },
    [validate, onChange],
  );

  return (
    <div className="date-range-picker" aria-label="Date range filter">
      {/* Loading overlay — shown while a filtered API call is in-flight */}
      {isLoading && (
        <div className="date-filter-loading" role="status" aria-live="polite">
          <span className="date-filter-spinner" aria-hidden="true" />
          <span className="date-filter-loading-text">Applying filter…</span>
        </div>
      )}

      <div className="date-range-picker__inputs">
        {/* From */}
        <div className="date-range-picker__field">
          <label
            className="date-range-picker__label"
            htmlFor={`${id}-start`}
          >
            From
          </label>
          <input
            id={`${id}-start`}
            className="date-range-picker__input"
            type="date"
            min={minDate}
            max={localEnd || maxDate}
            value={localStart}
            onChange={(e) => setLocalStart(e.target.value)}
            onBlur={() => handleCommit(localStart, localEnd)}
            disabled={isLoading}
            aria-label="Start date"
          />
        </div>

        {/* To */}
        <div className="date-range-picker__field">
          <label
            className="date-range-picker__label"
            htmlFor={`${id}-end`}
          >
            To
          </label>
          <input
            id={`${id}-end`}
            className="date-range-picker__input"
            type="date"
            min={localStart || minDate}
            max={maxDate}
            value={localEnd}
            onChange={(e) => setLocalEnd(e.target.value)}
            onBlur={() => handleCommit(localStart, localEnd)}
            disabled={isLoading}
            aria-label="End date"
          />
        </div>

        {/* Reset to full range */}
        {(localStart !== minDate || localEnd !== maxDate) && !isLoading && (
          <button
            type="button"
            className="date-range-picker__reset"
            onClick={() => {
              setLocalStart(minDate);
              setLocalEnd(maxDate);
              setValidationError(null);
              onChange(minDate, maxDate);
            }}
            aria-label="Reset date range to full range"
            title="Reset to full range"
          >
            ↺
          </button>
        )}
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="date-range-picker__error" role="alert">
          {validationError}
        </p>
      )}
    </div>
  );
}
