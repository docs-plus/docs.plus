import { useCallback, useMemo, useState } from 'react'

/**
 * Hook for managing bulk selection in data tables
 * Used for bulk actions like delete, export, update
 *
 * @param items - Array of items to select from
 * @param getKey - Optional function to extract unique key from item (defaults to item.id)
 */
export function useBulkSelection<T>(
  items: T[],
  getKey: (item: T) => string = (item) => (item as { id: string }).id
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length && items.length > 0) {
        return new Set()
      }
      return new Set(items.map(getKey))
    })
  }, [items, getKey])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectItems = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const selectedItems = useMemo(() => {
    return items.filter((i) => selectedIds.has(getKey(i)))
  }, [items, selectedIds, getKey])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const isAllSelected = useMemo(() => {
    return selectedIds.size === items.length && items.length > 0
  }, [selectedIds.size, items.length])

  const isPartialSelected = useMemo(() => {
    return selectedIds.size > 0 && selectedIds.size < items.length
  }, [selectedIds.size, items.length])

  return {
    selectedIds,
    selectedItems,
    count: selectedIds.size,
    isSelected,
    isAllSelected,
    isPartialSelected,
    toggleItem,
    toggleAll,
    clearSelection,
    selectItems
  }
}
