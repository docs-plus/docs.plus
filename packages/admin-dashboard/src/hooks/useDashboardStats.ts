import { useQuery } from '@tanstack/react-query'

import { fetchDashboardStats } from '@/services/api'
import { fetchSupabaseStats } from '@/services/supabase'

export function useDashboardStats() {
  const documentStatsQuery = useQuery({
    queryKey: ['admin', 'document-stats'],
    queryFn: fetchDashboardStats,
    staleTime: 1000 * 60 // 1 minute
  })

  const supabaseStatsQuery = useQuery({
    queryKey: ['admin', 'supabase-stats'],
    queryFn: fetchSupabaseStats,
    staleTime: 1000 * 60 // 1 minute
  })

  return {
    documentStats: documentStatsQuery.data,
    supabaseStats: supabaseStatsQuery.data,
    loading: documentStatsQuery.isLoading || supabaseStatsQuery.isLoading,
    error: documentStatsQuery.error || supabaseStatsQuery.error,
    refetch: () => {
      documentStatsQuery.refetch()
      supabaseStatsQuery.refetch()
    },
    isRefetching: documentStatsQuery.isRefetching || supabaseStatsQuery.isRefetching
  }
}
