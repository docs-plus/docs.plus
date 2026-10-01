import { ReactNode } from 'react'
import {
  LuArrowDown,
  LuArrowUp,
  LuArrowUpDown,
  LuChevronLeft,
  LuChevronRight
} from 'react-icons/lu'

import type { SortDirection } from '@/types'

interface Column<T> {
  key: keyof T | string
  header: ReactNode
  render?: (item: T) => ReactNode
  className?: string
  sortable?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  pagination?: {
    page: number
    totalPages: number
    total: number
    pageSize?: number // Items per page (default: 20)
    onPageChange: (page: number) => void
  }
  sorting?: {
    sortKey: string | null
    sortDirection: SortDirection
    onSort: (key: string) => void
  }
  // Required stable row identity — index keys let realtime reorders attach
  // row state (e.g. Avatar fallbacks) to the wrong record.
  rowKey: (item: T) => string
  emptyMessage?: string
}

export function DataTable<T extends object>({
  columns,
  data,
  loading,
  pagination,
  sorting,
  rowKey,
  emptyMessage = 'No data available'
}: DataTableProps<T>) {
  const renderSortIcon = (colKey: string) => {
    if (!sorting) return null
    if (sorting.sortKey !== colKey) {
      return <LuArrowUpDown className="text-base-content/50 h-3.5 w-3.5" aria-hidden />
    }
    return sorting.sortDirection === 'asc' ? (
      <LuArrowUp className="text-primary h-3.5 w-3.5" aria-hidden />
    ) : (
      <LuArrowDown className="text-primary h-3.5 w-3.5" aria-hidden />
    )
  }

  const ariaSort = (colKey: string) => {
    if (sorting?.sortKey !== colKey) return 'none'
    return sorting.sortDirection === 'asc' ? 'ascending' : 'descending'
  }

  if (!loading && data.length === 0) {
    return <div className="text-base-content/60 py-12 text-center">{emptyMessage}</div>
  }

  const pageSize = pagination?.pageSize || 20
  const start = pagination ? (pagination.page - 1) * pageSize + 1 : 0
  const end = pagination ? Math.min(pagination.page * pageSize, pagination.total) : 0

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => {
                const key = String(col.key)
                if (loading || !col.sortable || !sorting) {
                  return (
                    <th key={key} className={col.className}>
                      {col.header}
                    </th>
                  )
                }
                return (
                  <th key={key} className={col.className} aria-sort={ariaSort(key)}>
                    <button
                      type="button"
                      onClick={() => sorting.onSort(key)}
                      className="rounded-field hover:bg-base-200 focus-visible:ring-primary -mx-1.5 -my-1 flex cursor-pointer items-center gap-1.5 px-1.5 py-1 transition-colors outline-none select-none focus-visible:ring-2">
                      <span>{col.header}</span>
                      {renderSortIcon(key)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {columns.map((col) => (
                      <td key={String(col.key)}>
                        <div className="skeleton h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((item) => (
                  <tr key={rowKey(item)} className="row-hover">
                    {columns.map((col) => (
                      <td key={String(col.key)} className={col.className}>
                        {col.render ? col.render(item) : String(item[col.key as keyof T] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {!loading && pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between px-2">
          <p className="text-base-content/60 text-sm">
            {`Showing ${start} to ${end} of ${pagination.total}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-square"
              aria-label="Previous page"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}>
              <LuChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-sm tabular-nums">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-sm btn-square"
              aria-label="Next page"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}>
              <LuChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
