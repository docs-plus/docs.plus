import { useQuery } from '@tanstack/react-query'

import { fetchDauTrend, fetchRetentionMetrics, fetchUserLifecycleSegments } from '@/services/api'

export function useRetentionMetrics() {
  return useQuery({
    queryKey: ['admin', 'retention-metrics'],
    queryFn: fetchRetentionMetrics,
    staleTime: 1000 * 60 // 1 minute
  })
}

export function useUserLifecycleSegments() {
  return useQuery({
    queryKey: ['admin', 'user-lifecycle-segments'],
    queryFn: fetchUserLifecycleSegments,
    staleTime: 1000 * 60 // 1 minute
  })
}

export function useDauTrend(days = 30) {
  return useQuery({
    queryKey: ['admin', 'dau-trend', days],
    queryFn: () => fetchDauTrend(days),
    staleTime: 1000 * 60 // 1 minute
  })
}
