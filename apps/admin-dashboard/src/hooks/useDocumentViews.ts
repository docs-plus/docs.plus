import { useQuery } from '@tanstack/react-query'

import { fetchTopViewedDocuments, fetchViewsSummary, fetchViewsTrend } from '@/services/api'

export function useViewsSummary() {
  return useQuery({
    queryKey: ['admin', 'views-summary'],
    queryFn: fetchViewsSummary,
    staleTime: 1000 * 60 // 1 minute
  })
}

export function useTopViewedDocuments(limit = 10, days = 7) {
  return useQuery({
    queryKey: ['admin', 'top-viewed-documents', limit, days],
    queryFn: () => fetchTopViewedDocuments(limit, days),
    staleTime: 1000 * 60 // 1 minute
  })
}

export function useViewsTrend(days = 30, slug?: string) {
  return useQuery({
    queryKey: ['admin', 'views-trend', days, slug],
    queryFn: () => fetchViewsTrend(days, slug),
    staleTime: 1000 * 60 // 1 minute
  })
}
