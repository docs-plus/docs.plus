import { useQuery } from '@tanstack/react-query';
import {
  fetchViewsSummary,
  fetchTopViewedDocuments,
  fetchViewsTrend,
  fetchDocumentViewStats,
} from '@/services/api';

/**
 * Hook for fetching document views summary
 */
export function useViewsSummary() {
  return useQuery({
    queryKey: ['admin', 'views-summary'],
    queryFn: fetchViewsSummary,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching top viewed documents
 */
export function useTopViewedDocuments(limit = 10, days = 7) {
  return useQuery({
    queryKey: ['admin', 'top-viewed-documents', limit, days],
    queryFn: () => fetchTopViewedDocuments(limit, days),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching view trends (for charts)
 */
export function useViewsTrend(days = 30, slug?: string) {
  return useQuery({
    queryKey: ['admin', 'views-trend', days, slug],
    queryFn: () => fetchViewsTrend(days, slug),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook for fetching single document view stats
 */
export function useDocumentViewStats(slug: string) {
  return useQuery({
    queryKey: ['admin', 'document-view-stats', slug],
    queryFn: () => fetchDocumentViewStats(slug),
    enabled: !!slug,
    staleTime: 1000 * 60, // 1 minute
  });
}
