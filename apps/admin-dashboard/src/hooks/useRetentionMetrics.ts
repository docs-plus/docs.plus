import { useQuery } from '@tanstack/react-query'

import {
  fetchDauTrend,
  fetchMessageTypeDistribution,
  fetchRetentionMetrics,
  fetchSignupsTrend,
  fetchUserLifecycleSegments
} from '@/services/api'

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

export function useSignupsTrend(days = 30) {
  return useQuery({
    queryKey: ['admin', 'signups-trend', days],
    queryFn: () => fetchSignupsTrend(days),
    staleTime: 1000 * 60 // 1 minute
  })
}

export function useMessageTypeDistribution(days = 7) {
  return useQuery({
    queryKey: ['admin', 'message-types', days],
    queryFn: () => fetchMessageTypeDistribution(days),
    staleTime: 1000 * 60 // 1 minute
  })
}
