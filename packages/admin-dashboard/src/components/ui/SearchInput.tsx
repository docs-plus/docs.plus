import { useState, useCallback, useEffect } from 'react';
import { LuSearch, LuX } from 'react-icons/lu';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  value?: string; // Controlled value (from URL params)
  defaultValue?: string;
  className?: string;
}

/**
 * Search input with icon, clear button, and search button
 * Supports both controlled (value prop) and uncontrolled (defaultValue) modes
 */
export function SearchInput({
  placeholder = 'Search...',
  onSearch,
  value: controlledValue,
  defaultValue = '',
  className = '',
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);

  // Sync internal value when controlled value changes (for URL params)
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      onSearch(internalValue);
    },
    [onSearch, internalValue]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onSearch('');
  }, [onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value);
  }, []);

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LuSearch className="h-4 w-4 text-base-content/40" />
          </div>
          <input
            type="text"
            placeholder={placeholder}
            className={`input input-bordered w-full pl-10 ${internalValue ? 'pr-10' : 'pr-3'}`}
            value={internalValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {internalValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-error transition-colors"
              title="Clear search (Esc)"
            >
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary">
          <LuSearch className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  );
}
