import { useState } from 'react';
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import {
  LuUsers,
  LuFileText,
  LuMessageSquare,
  LuBell,
  LuUserCheck,
  LuLock,
  LuEye,
  LuMonitor,
  LuActivity,
} from 'react-icons/lu';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/cards/StatCard';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { ChartErrorBoundary } from '@/components/ui/ChartErrorBoundary';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useViewsSummary, useTopViewedDocuments, useViewsTrend } from '@/hooks/useDocumentViews';
import { useRetentionMetrics, useUserLifecycleSegments, useDauTrend } from '@/hooks/useRetentionMetrics';
import {
  ViewsTrendChart,
  TopViewedDocuments,
  ViewsSummaryCards,
  DeviceBreakdown,
  UserTypeBreakdown,
  RetentionCards,
  DauTrendChart,
  UserLifecycleChart,
} from '@/components/charts';

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};

export default function OverviewPage() {
  const { documentStats, supabaseStats, loading, refetch, isRefetching } =
    useDashboardStats();

  // Document Views Analytics
  const [viewsDays, setViewsDays] = useState(30);
  const { data: viewsSummary, isLoading: viewsSummaryLoading } = useViewsSummary();
  const { data: topDocuments, isLoading: topDocsLoading } = useTopViewedDocuments(5, viewsDays);
  const { data: viewsTrend, isLoading: trendLoading } = useViewsTrend(viewsDays);

  // User Retention Analytics (Phase 8)
  const { data: retentionMetrics, isLoading: retentionLoading } = useRetentionMetrics();
  const { data: lifecycleSegments, isLoading: lifecycleLoading } = useUserLifecycleSegments();
  const { data: dauTrend, isLoading: dauTrendLoading } = useDauTrend(viewsDays);

  return (
    <>
      <Head>
        <title>Overview | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Overview"
          subtitle="Platform statistics at a glance"
          onRefresh={refetch}
          refreshing={isRefetching}
        />

        <div className="p-6 space-y-6">
          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Users"
              value={supabaseStats?.users.total ?? 0}
              icon={<LuUsers className="h-6 w-6" />}
              trend={{
                value: supabaseStats?.users.newThisWeek ?? 0,
                label: 'this week',
                direction: (supabaseStats?.users.newThisWeek ?? 0) > 0 ? 'up' : 'neutral',
              }}
              loading={loading}
            />

            <StatCard
              title="Documents"
              value={documentStats?.documents.total ?? 0}
              icon={<LuFileText className="h-6 w-6" />}
              trend={{
                value: documentStats?.documents.recentlyCreated ?? 0,
                label: 'this week',
                direction: (documentStats?.documents.recentlyCreated ?? 0) > 0 ? 'up' : 'neutral',
              }}
              loading={loading}
            />

            <StatCard
              title="Channels"
              value={supabaseStats?.channels.total ?? 0}
              icon={<LuMessageSquare className="h-6 w-6" />}
              loading={loading}
            />

            <StatCard
              title="Messages Today"
              value={supabaseStats?.messages.today ?? 0}
              icon={<LuMessageSquare className="h-6 w-6" />}
              trend={{
                value: supabaseStats?.messages.total ?? 0,
                label: 'total',
                direction: 'neutral',
              }}
              loading={loading}
            />
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Online Now"
              value={supabaseStats?.users.online ?? 0}
              icon={<LuUserCheck className="h-6 w-6" />}
              loading={loading}
            />

            <StatCard
              title="Unread Notifications"
              value={supabaseStats?.notifications.unread ?? 0}
              icon={<LuBell className="h-6 w-6" />}
              loading={loading}
            />

            <StatCard
              title="Private Documents"
              value={documentStats?.documents.private ?? 0}
              icon={<LuLock className="h-6 w-6" />}
              loading={loading}
            />

            <StatCard
              title="Read-Only Documents"
              value={documentStats?.documents.readOnly ?? 0}
              icon={<LuEye className="h-6 w-6" />}
              loading={loading}
            />
          </div>

          {/* Document Stats Card */}
          <div className="bg-base-100 rounded-box border border-base-300 p-5">
            <h2 className="text-lg font-semibold mb-4">Document Statistics</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-base-content/60">Total Versions</p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <span className="skeleton h-7 w-16 inline-block" />
                  ) : (
                    documentStats?.documents.totalVersions.toLocaleString()
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-base-content/60">Avg Versions/Doc</p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <span className="skeleton h-7 w-12 inline-block" />
                  ) : (
                    documentStats?.documents.avgVersionsPerDoc
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-base-content/60">Total Notifications</p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <span className="skeleton h-7 w-16 inline-block" />
                  ) : (
                    supabaseStats?.notifications.total.toLocaleString()
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-base-content/60">Read Rate</p>
                <p className="text-2xl font-bold">
                  {loading ? (
                    <span className="skeleton h-7 w-14 inline-block" />
                  ) : (
                    `${supabaseStats?.notifications.total
                      ? Math.round(
                          ((supabaseStats.notifications.total -
                            supabaseStats.notifications.unread) /
                            supabaseStats.notifications.total) *
                            100
                        )
                      : 0}%`
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* User Retention Section (Phase 8) */}
          <CollapsibleSection
            title="User Retention & Engagement"
            icon={<LuUsers className="h-5 w-5" />}
            defaultOpen={true}
            actions={
              <div className="join">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    className={`join-item btn btn-sm ${viewsDays === days ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setViewsDays(days)}
                  >
                    {days}d
                  </button>
                ))}
              </div>
            }
          >
            {/* DAU/WAU/MAU Cards */}
            <ChartErrorBoundary fallbackHeight={120}>
              <RetentionCards data={retentionMetrics} loading={retentionLoading} />
            </ChartErrorBoundary>

            {/* DAU Trend + User Lifecycle */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* DAU Trend Chart */}
              <div className="lg:col-span-2 bg-base-100 rounded-box border border-base-300 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LuActivity className="h-5 w-5 text-primary" />
                  Daily Active Users Trend
                </h3>
                <ChartErrorBoundary fallbackHeight={280}>
                  <DauTrendChart data={dauTrend || []} loading={dauTrendLoading} height={280} />
                </ChartErrorBoundary>
              </div>

              {/* User Lifecycle Segments */}
              <div className="bg-base-100 rounded-box border border-base-300 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LuUserCheck className="h-5 w-5 text-primary" />
                  User Lifecycle
                </h3>
                <ChartErrorBoundary fallbackHeight={200}>
                  <UserLifecycleChart data={lifecycleSegments} loading={lifecycleLoading} />
                </ChartErrorBoundary>
              </div>
            </div>
          </CollapsibleSection>

          {/* Document Views Analytics Section */}
          <CollapsibleSection
            title="Document Views Analytics"
            icon={<LuEye className="h-5 w-5" />}
            defaultOpen={true}
          >
            {/* Views Summary Cards */}
            <ChartErrorBoundary fallbackHeight={120}>
              <ViewsSummaryCards data={viewsSummary} loading={viewsSummaryLoading} />
            </ChartErrorBoundary>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Views Trend Chart */}
              <div className="lg:col-span-2 bg-base-100 rounded-box border border-base-300 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LuEye className="h-5 w-5 text-primary" />
                  Views Trend
                </h3>
                <ChartErrorBoundary fallbackHeight={280}>
                  <ViewsTrendChart data={viewsTrend || []} loading={trendLoading} height={280} />
                </ChartErrorBoundary>
              </div>

              {/* Top Viewed Documents */}
              <div className="bg-base-100 rounded-box border border-base-300 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LuFileText className="h-5 w-5 text-primary" />
                  Top Documents
                </h3>
                <ChartErrorBoundary fallbackHeight={200}>
                  <TopViewedDocuments data={topDocuments || []} loading={topDocsLoading} limit={5} />
                </ChartErrorBoundary>
              </div>
            </div>

            {/* Device & User Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-base-100 rounded-box border border-base-300 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LuMonitor className="h-5 w-5 text-primary" />
                  Device Breakdown
                </h3>
                <ChartErrorBoundary fallbackHeight={150}>
                  <DeviceBreakdown data={viewsSummary} loading={viewsSummaryLoading} />
                </ChartErrorBoundary>
              </div>

              <div className="bg-base-100 rounded-box border border-base-300 p-5">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LuUsers className="h-5 w-5 text-primary" />
                  User Types
                </h3>
                <ChartErrorBoundary fallbackHeight={150}>
                  <UserTypeBreakdown data={viewsSummary} loading={viewsSummaryLoading} />
                </ChartErrorBoundary>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </AdminLayout>
    </>
  );
}
