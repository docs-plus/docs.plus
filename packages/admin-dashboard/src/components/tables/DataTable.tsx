import { ReactNode } from 'react';
import { LuChevronLeft, LuChevronRight, LuArrowUp, LuArrowDown, LuArrowUpDown } from 'react-icons/lu';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    page: number;
    totalPages: number;
    total: number;
    pageSize?: number; // Items per page (default: 20)
    onPageChange: (page: number) => void;
  };
  sorting?: {
    sortKey: string | null;
    sortDirection: SortDirection;
    onSort: (key: string) => void;
  };
  emptyMessage?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  loading,
  pagination,
  sorting,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const renderSortIcon = (colKey: string) => {
    if (!sorting) return null;
    if (sorting.sortKey !== colKey) {
      return <LuArrowUpDown className="h-3.5 w-3.5 text-base-content/30" />;
    }
    return sorting.sortDirection === 'asc' ? (
      <LuArrowUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <LuArrowDown className="h-3.5 w-3.5 text-primary" />
    );
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={String(col.key)}>
                    <div className="skeleton h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-base-content/60">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((col) => {
                const isSortable = col.sortable && sorting;
                return (
                  <th
                    key={String(col.key)}
                    className={`${col.className || ''} ${isSortable ? 'cursor-pointer select-none hover:bg-base-200 transition-colors' : ''}`}
                    onClick={isSortable ? () => sorting.onSort(String(col.key)) : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && renderSortIcon(String(col.key))}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="hover">
                {columns.map((col) => (
                  <td key={String(col.key)} className={col.className}>
                    {col.render
                      ? col.render(item)
                      : String(item[col.key as keyof T] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <p className="text-sm text-base-content/60">
            {(() => {
              const pageSize = pagination.pageSize || 20;
              const start = (pagination.page - 1) * pageSize + 1;
              const end = Math.min(pagination.page * pageSize, pagination.total);
              return `Showing ${start} to ${end} of ${pagination.total}`;
            })()}
          </p>
          <div className="join">
            <button
              className="join-item btn btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              <LuChevronLeft className="h-4 w-4" />
            </button>
            <button className="join-item btn btn-sm">
              {pagination.page} / {pagination.totalPages}
            </button>
            <button
              className="join-item btn btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              <LuChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
