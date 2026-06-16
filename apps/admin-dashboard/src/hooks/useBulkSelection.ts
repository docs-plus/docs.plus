import { useCallback, useMemo, useState } from 'react'

/**
 * Bulk-selection state for data tables. The exposed selection is always pruned
 * to the current `items`, so a filter change or refetch can't leave phantom ids
 * that a bulk action would act on. `getKey` extracts the key (defaults to id).
 */
export function useBulkSelection<T>(
  items: T[],
  getKey: (item: T) => string = (item) => (item as { id: string }).id
) {
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(new Set())

  const validIds = useMemo(() => new Set(items.map(getKey)), [items, getKey])

  // Phantom-free view of the selection — ids no longer present in `items` drop out.
  const selectedIds = useMemo(
    () => new Set([...rawSelectedIds].filter((id) => validIds.has(id))),
    [rawSelectedIds, validIds]
  )

  const toggleItem = useCallback((id: string) => {
    setRawSelectedIds((prev) => {
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
    setRawSelectedIds((prev) => {
      const visible = new Set([...prev].filter((id) => validIds.has(id)))
      if (visible.size === items.length && items.length > 0) {
        return new Set()
      }
      return new Set(items.map(getKey))
    })
  }, [items, getKey, validIds])

  const clearSelection = useCallback(() => {
    setRawSelectedIds(new Set())
  }, [])

  const selectItems = useCallback((ids: string[]) => {
    setRawSelectedIds(new Set(ids))
  }, [])

  const selectedItems = useMemo(
    () => items.filter((i) => selectedIds.has(getKey(i))),
    [items, selectedIds, getKey]
  )

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const isAllSelected = useMemo(
    () => selectedIds.size === items.length && items.length > 0,
    [selectedIds.size, items.length]
  )

  const isPartialSelected = useMemo(
    () => selectedIds.size > 0 && selectedIds.size < items.length,
    [selectedIds.size, items.length]
  )

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
