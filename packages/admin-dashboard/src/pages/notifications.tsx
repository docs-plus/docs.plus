import { useCallback } from 'react';
import Head from 'next/head';
import type { GetServerSideProps } from 'next';
import { useQuery } from '@tanstack/react-query';

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};
import {
  LuBell,
  LuBellOff,
  LuMail,
  LuSmartphone,
  LuCheck,
  LuClock,
  LuCircleAlert,
  LuRadio,
} from 'react-icons/lu';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/cards/StatCard';
import {
  fetchNotificationStats,
  fetchPushStats,
  fetchEmailStats,
} from '@/services/supabase';
import { useMultiTableSubscription } from '@/hooks/useRealtimeSubscription';

export default function NotificationsPage() {
  const {
    data: notifStats,
    isLoading: notifLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['admin', 'notifications', 'stats'],
    queryFn: fetchNotificationStats,
  });

  const { data: pushStats, isLoading: pushLoading, refetch: refetchPush } = useQuery({
    queryKey: ['admin', 'push', 'stats'],
    queryFn: fetchPushStats,
  });

  const { data: emailStats, isLoading: emailLoading, refetch: refetchEmail } = useQuery({
    queryKey: ['admin', 'email', 'stats'],
    queryFn: fetchEmailStats,
  });

  // Real-time subscription to notification-related tables
  const handleRealtimeChange = useCallback(() => {
    refetch();
    refetchPush();
    refetchEmail();
  }, [refetch, refetchPush, refetchEmail]);

  useMultiTableSubscription(
    ['notifications', 'push_subscriptions', 'email_queue'],
    handleRealtimeChange
  );

  const loading = notifLoading || pushLoading || emailLoading;

  const notificationTypes = ['mention', 'reply', 'message', 'reaction', 'channel_event'];

  return (
    <>
      <Head>
        <title>Notifications | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Notifications"
          subtitle={
            <span className="flex items-center gap-2">
              Notification, push, and email statistics
              <span className="badge badge-success badge-xs gap-1">
                <LuRadio className="h-3 w-3" /> Live
              </span>
            </span>
          }
          onRefresh={() => refetch()}
          refreshing={isRefetching}
        />

        <div className="p-6 space-y-6">
          {/* Main Notification Stats */}
          <div>
            <h2 className="text-lg font-semibold mb-4">In-App Notifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Notifications"
                value={notifStats?.total ?? 0}
                icon={<LuBell className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Unread"
                value={notifStats?.unread ?? 0}
                icon={<LuBellOff className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Read Rate"
                value={`${notifStats?.readRate ?? 0}%`}
                icon={<LuCheck className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Mentions"
                value={notifStats?.byType?.mention ?? 0}
                loading={loading}
              />
            </div>
          </div>

          {/* Notification by Type */}
          <div className="bg-base-100 rounded-box border border-base-300 p-5">
            <h2 className="text-lg font-semibold mb-4">By Type</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {notificationTypes.map((type) => (
                <div key={type} className="text-center">
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <span className="skeleton h-7 w-12 inline-block" />
                    ) : (
                      (notifStats?.byType?.[type] ?? 0).toLocaleString()
                    )}
                  </p>
                  <p className="text-sm text-base-content/60 capitalize">
                    {type.replace('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Push Notifications */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Push Notifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Active Subscriptions"
                value={pushStats?.active ?? 0}
                icon={<LuSmartphone className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Failed Deliveries"
                value={pushStats?.failed ?? 0}
                icon={<LuCircleAlert className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Success Rate"
                value={
                  pushStats && pushStats.active > 0
                    ? `${Math.round(((pushStats.active - pushStats.failed) / pushStats.active) * 100)}%`
                    : '100%'
                }
                loading={loading}
              />
            </div>
          </div>

          {/* Email Notifications */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Email Queue</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Pending"
                value={emailStats?.pending ?? 0}
                icon={<LuClock className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Sent"
                value={emailStats?.sent ?? 0}
                icon={<LuMail className="h-6 w-6" />}
                loading={loading}
              />
              <StatCard
                title="Failed"
                value={emailStats?.failed ?? 0}
                icon={<LuCircleAlert className="h-6 w-6" />}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </AdminLayout>
    </>
  );
}
