import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'

import type { SortDirection } from '@/types'

interface TableParams {
  page: number
  search: string
  sortKey: string | null
  sortDirection: SortDirection
}

interface UseTableParamsOptions {
  defaultSortKey?: string
  defaultSortDirection?: SortDirection
}

/** Table page/search/sort lives in the URL so bookmark, share, and back/forward work. */
export function useTableParams(options: UseTableParamsOptions = {}) {
  const router = useRouter()
  const { defaultSortKey = null, defaultSortDirection = 'desc' } = options

  const params: TableParams = useMemo(() => {
    // Return defaults when router is not ready (SSG/SSR)
    if (!router.isReady) {
      return {
        page: 1,
        search: '',
        sortKey: defaultSortKey,
        sortDirection: defaultSortDirection
      }
    }

    const query = router.query
    return {
      page: parseInt(query.page as string) || 1,
      search: (query.search as string) || '',
      sortKey: (query.sortKey as string) || defaultSortKey,
      sortDirection: ((query.sortDir as string) || defaultSortDirection) as SortDirection
    }
  }, [router.isReady, router.query, defaultSortKey, defaultSortDirection])

  const updateParams = useCallback(
    (updates: Partial<TableParams>) => {
      const newQuery = { ...router.query }

      if (updates.page !== undefined) {
        if (updates.page === 1) {
          delete newQuery.page // Don't show page=1 in URL
        } else {
          newQuery.page = String(updates.page)
        }
      }

      if (updates.search !== undefined) {
        if (updates.search === '') {
          delete newQuery.search
        } else {
          newQuery.search = updates.search
        }
      }

      if (updates.sortKey !== undefined) {
        if (updates.sortKey === defaultSortKey) {
          delete newQuery.sortKey
        } else if (updates.sortKey) {
          newQuery.sortKey = updates.sortKey
        } else {
          delete newQuery.sortKey
        }
      }

      if (updates.sortDirection !== undefined) {
        if (updates.sortDirection === defaultSortDirection) {
          delete newQuery.sortDir
        } else {
          newQuery.sortDir = updates.sortDirection
        }
      }

      // Use shallow routing to avoid data refetch from getServerSideProps
      router.push({ pathname: router.pathname, query: newQuery }, undefined, {
        shallow: true
      })
    },
    [router, defaultSortKey, defaultSortDirection]
  )

  const setPage = useCallback(
    (page: number) => {
      updateParams({ page })
    },
    [updateParams]
  )

  const setSearch = useCallback(
    (search: string) => {
      updateParams({ search, page: 1 })
    },
    [updateParams]
  )

  const handleSort = useCallback(
    (key: string) => {
      if (params.sortKey === key) {
        updateParams({
          sortDirection: params.sortDirection === 'asc' ? 'desc' : 'asc',
          page: 1
        })
      } else {
        updateParams({ sortKey: key, sortDirection: 'desc', page: 1 })
      }
    },
    [params.sortKey, params.sortDirection, updateParams]
  )

  const clearFilters = useCallback(() => {
    updateParams({
      search: '',
      sortKey: defaultSortKey,
      sortDirection: defaultSortDirection,
      page: 1
    })
  }, [updateParams, defaultSortKey, defaultSortDirection])

  return {
    ...params,
    setPage,
    setSearch,
    handleSort,
    clearFilters,
    updateParams
  }
}
