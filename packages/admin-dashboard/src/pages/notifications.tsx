import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useCallback } from 'react'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import {
  LuBell,
  LuBellOff,
  LuCheck,
  LuCircleAlert,
  LuClock,
  LuMail,
  LuRadio,
  LuSmartphone} from 'react-icons/lu'

import { StatCard } from '@/components/cards/StatCard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { useMultiTableSubscription } from '@/hooks/useRealtimeSubscription'
import { fetchEmailStats,fetchNotificationStats, fetchPushStats } from '@/services/supabase'

export default function NotificationsPage() {
  const {
    data: notifStats,
    isLoading: notifLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['admin', 'notifications', 'stats'],
    queryFn: fetchNotificationStats
  })

  const {
    data: pushStats,
    isLoading: pushLoading,
    refetch: refetchPush
  } = useQuery({
    queryKey: ['admin', 'push', 'stats'],
    queryFn: fetchPushStats
  })

  const {
    data: emailStats,
    isLoading: emailLoading,
    refetch: refetchEmail
  } = useQuery({
    queryKey: ['admin', 'email', 'stats'],
    queryFn: fetchEmailStats
  })

  // Real-time subscription to notification-related tables
  const handleRealtimeChange = useCallback(() => {
    refetch()
    refetchPush()
    refetchEmail()
  }, [refetch, refetchPush, refetchEmail])

  useMultiTableSubscription(
    ['notifications', 'push_subscriptions', 'email_queue'],
    handleRealtimeChange
  )

  const loading = notifLoading || pushLoading || emailLoading

  const notificationTypes = ['mention', 'reply', 'message', 'reaction', 'channel_event']

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

        <div className="space-y-6 p-6">
          {/* Main Notification Stats */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">In-App Notifications</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
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
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h2 className="mb-4 text-lg font-semibold">By Type</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              {notificationTypes.map((type) => (
                <div key={type} className="text-center">
                  <p className="text-2xl font-bold">
                    {loading ? (
                      <span className="skeleton inline-block h-7 w-12" />
                    ) : (
                      (notifStats?.byType?.[type] ?? 0).toLocaleString()
                    )}
                  </p>
                  <p className="text-base-content/60 text-sm capitalize">
                    {type.replace('_', ' ')}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Push Notifications */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Push Notifications</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
            <h2 className="mb-4 text-lg font-semibold">Email Queue</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
  )
}
