import { useCallback, useEffect, useState } from 'react'
import { LuSearch, LuX } from 'react-icons/lu'

interface SearchInputProps {
  placeholder?: string
  onSearch: (value: string) => void
  value: string
  className?: string
}

export function SearchInput({
  placeholder = 'Search...',
  onSearch,
  value,
  className = ''
}: SearchInputProps) {
  const [internalValue, setInternalValue] = useState(value)

  useEffect(() => {
    setInternalValue(value)
  }, [value])

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
          {/* `z-1`: the daisyUI 5 `.input` is `relative` with a fill, so it would paint over the glyph. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-1 flex items-center pl-3">
            <LuSearch className="text-base-content/50 h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder={placeholder}
            aria-label={placeholder}
            className={`input w-full pl-10 ${internalValue ? 'pr-10' : 'pr-3'}`}
            value={internalValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
          />
          {internalValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-base-content/70 hover:text-base-content absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
              aria-label="Clear search"
              title="Clear search (Esc)">
              <LuX className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" aria-label="Search">
          <LuSearch className="h-4 w-4" />
          <span className="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  )
}
