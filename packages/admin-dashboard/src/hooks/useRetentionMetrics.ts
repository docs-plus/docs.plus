import { useQuery } from '@tanstack/react-query';
import {
  fetchRetentionMetrics,
  fetchUserLifecycleSegments,
  fetchDauTrend,
  fetchActivityHeatmap,
  fetchTopActiveDocuments,
  fetchCommunicationStats,
  fetchNotificationReach,
} from '@/services/api';

/**
 * Hook for fetching retention metrics (DAU/WAU/MAU)
 */
export function useRetentionMetrics() {
  return useQuery({
    queryKey: ['admin', 'retention-metrics'],
    queryFn: fetchRetentionMetrics,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching user lifecycle segments
 */
export function useUserLifecycleSegments() {
  return useQuery({
    queryKey: ['admin', 'user-lifecycle-segments'],
    queryFn: fetchUserLifecycleSegments,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching DAU trend
 */
export function useDauTrend(days = 30) {
  return useQuery({
    queryKey: ['admin', 'dau-trend', days],
    queryFn: () => fetchDauTrend(days),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching activity heatmap
 */
export function useActivityHeatmap(days = 7) {
  return useQuery({
    queryKey: ['admin', 'activity-heatmap', days],
    queryFn: () => fetchActivityHeatmap(days),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching top active documents
 */
export function useTopActiveDocuments(limit = 5, days = 7) {
  return useQuery({
    queryKey: ['admin', 'top-active-documents', limit, days],
    queryFn: () => fetchTopActiveDocuments(limit, days),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching communication stats
 */
export function useCommunicationStats(days = 7) {
  return useQuery({
    queryKey: ['admin', 'communication-stats', days],
    queryFn: () => fetchCommunicationStats(days),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching notification reach
 */
export function useNotificationReach() {
  return useQuery({
    queryKey: ['admin', 'notification-reach'],
    queryFn: fetchNotificationReach,
    staleTime: 1000 * 60, // 1 minute
  });
}
