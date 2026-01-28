import { useRouter } from 'next/router';
import { useCallback, useMemo } from 'react';

export type SortDirection = 'asc' | 'desc';

interface TableParams {
  page: number;
  search: string;
  sortKey: string | null;
  sortDirection: SortDirection;
}

interface UseTableParamsOptions {
  defaultSortKey?: string;
  defaultSortDirection?: SortDirection;
}

/**
 * Hook to manage table state (page, search, sort) via URL params
 * This enables bookmarking, sharing, and browser back/forward navigation
 */
export function useTableParams(options: UseTableParamsOptions = {}) {
  const router = useRouter();
  const { defaultSortKey = null, defaultSortDirection = 'desc' } = options;

  // Parse current params from URL
  const params: TableParams = useMemo(() => {
    const query = router.query;
    return {
      page: parseInt(query.page as string) || 1,
      search: (query.search as string) || '',
      sortKey: (query.sortKey as string) || defaultSortKey,
      sortDirection: ((query.sortDir as string) || defaultSortDirection) as SortDirection,
    };
  }, [router.query, defaultSortKey, defaultSortDirection]);

  // Update URL params without full page reload
  const updateParams = useCallback(
    (updates: Partial<TableParams>) => {
      const newQuery = { ...router.query };

      // Update or remove each param
      if (updates.page !== undefined) {
        if (updates.page === 1) {
          delete newQuery.page; // Don't show page=1 in URL
        } else {
          newQuery.page = String(updates.page);
        }
      }

      if (updates.search !== undefined) {
        if (updates.search === '') {
          delete newQuery.search;
        } else {
          newQuery.search = updates.search;
        }
      }

      if (updates.sortKey !== undefined) {
        if (updates.sortKey === defaultSortKey) {
          delete newQuery.sortKey;
        } else if (updates.sortKey) {
          newQuery.sortKey = updates.sortKey;
        } else {
          delete newQuery.sortKey;
        }
      }

      if (updates.sortDirection !== undefined) {
        if (updates.sortDirection === defaultSortDirection) {
          delete newQuery.sortDir;
        } else {
          newQuery.sortDir = updates.sortDirection;
        }
      }

      // Use shallow routing to avoid data refetch from getServerSideProps
      router.push({ pathname: router.pathname, query: newQuery }, undefined, {
        shallow: true,
      });
    },
    [router, defaultSortKey, defaultSortDirection]
  );

  // Helper: set page
  const setPage = useCallback(
    (page: number) => {
      updateParams({ page });
    },
    [updateParams]
  );

  // Helper: set search (resets page to 1)
  const setSearch = useCallback(
    (search: string) => {
      updateParams({ search, page: 1 });
    },
    [updateParams]
  );

  // Helper: toggle sort (resets page to 1)
  const handleSort = useCallback(
    (key: string) => {
      if (params.sortKey === key) {
        // Toggle direction
        updateParams({
          sortDirection: params.sortDirection === 'asc' ? 'desc' : 'asc',
          page: 1,
        });
      } else {
        // New column, default to desc
        updateParams({ sortKey: key, sortDirection: 'desc', page: 1 });
      }
    },
    [params.sortKey, params.sortDirection, updateParams]
  );

  // Helper: clear all filters
  const clearFilters = useCallback(() => {
    updateParams({
      search: '',
      sortKey: defaultSortKey,
      sortDirection: defaultSortDirection,
      page: 1,
    });
  }, [updateParams, defaultSortKey, defaultSortDirection]);

  return {
    ...params,
    setPage,
    setSearch,
    handleSort,
    clearFilters,
    updateParams,
  };
}
