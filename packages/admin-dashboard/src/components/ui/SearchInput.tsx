import { useCallback, useEffect, useState } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'

interface SearchInputProps {
  placeholder?: string
  onSearch: (value: string) => void
  value?: string // Controlled value (from URL params)
  defaultValue?: string
  className?: string
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
  className = ''
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(defaultValue)

  // Sync internal value when controlled value changes (for URL params)
  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue)
    }
  }, [controlledValue])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      onSearch(internalValue)
    },
    [onSearch, internalValue]
  )

  const handleClear = useCallback(() => {
    setInternalValue('')
    onSearch('')
  }, [onSearch])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClear()
      }
    },
    [handleClear]
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInternalValue(e.target.value)
  }, [])

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <LuSearch className="text-base-content/40 h-4 w-4" />
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
              className="hover:text-error absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
              title="Clear search (Esc)">
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
  )
}
