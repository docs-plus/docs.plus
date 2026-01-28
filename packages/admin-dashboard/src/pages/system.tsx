import Head from 'next/head'
import type { GetServerSideProps } from 'next'
import { useQuery } from '@tanstack/react-query'

// Disable static generation - pages require auth which needs client-side router
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}
import {
  LuActivity,
  LuDatabase,
  LuServer,
  LuCircleCheck,
  LuCircleAlert,
  LuClock
} from 'react-icons/lu'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { StatCard } from '@/components/cards/StatCard'
import { fetchTableSizes, checkDatabaseHealth } from '@/services/supabase'
import { checkApiHealth } from '@/services/api'
import { formatTime } from '@/utils/format'
import type { ServiceStatus } from '@/types'

async function checkAllServices(): Promise<ServiceStatus[]> {
  const [apiHealth, dbHealth] = await Promise.all([checkApiHealth(), checkDatabaseHealth()])

  const now = new Date().toISOString()

  return [
    {
      name: 'REST API',
      status: apiHealth.status as 'healthy' | 'degraded' | 'down',
      latency: apiHealth.latency,
      lastCheck: now
    },
    {
      name: 'Supabase Database',
      status: dbHealth.status as 'healthy' | 'degraded' | 'down',
      latency: dbHealth.latency,
      lastCheck: now
    }
  ]
}

export default function SystemPage() {
  const {
    data: services,
    isLoading: servicesLoading,
    refetch,
    isRefetching
  } = useQuery({
    queryKey: ['admin', 'system', 'services'],
    queryFn: checkAllServices,
    refetchInterval: 30000 // Refresh every 30s
  })

  const { data: tableSizes, isLoading: tablesLoading } = useQuery({
    queryKey: ['admin', 'system', 'tables'],
    queryFn: fetchTableSizes
  })

  const healthyCount = services?.filter((s) => s.status === 'healthy').length || 0
  const totalServices = services?.length || 0

  return (
    <>
      <Head>
        <title>System | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="System Health"
          subtitle="Service status and database statistics"
          onRefresh={() => refetch()}
          refreshing={isRefetching}
        />

        <div className="space-y-6 p-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard
              title="Services Healthy"
              value={`${healthyCount}/${totalServices}`}
              icon={<LuActivity className="h-6 w-6" />}
              loading={servicesLoading}
            />
            <StatCard
              title="Database Status"
              value={
                services?.find((s) => s.name === 'Supabase Database')?.status === 'healthy'
                  ? 'Online'
                  : 'Offline'
              }
              icon={<LuDatabase className="h-6 w-6" />}
              loading={servicesLoading}
            />
            <StatCard
              title="API Status"
              value={
                services?.find((s) => s.name === 'REST API')?.status === 'healthy'
                  ? 'Online'
                  : 'Offline'
              }
              icon={<LuServer className="h-6 w-6" />}
              loading={servicesLoading}
            />
          </div>

          {/* Service Status */}
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h2 className="mb-4 text-lg font-semibold">Service Status</h2>
            <div className="space-y-3">
              {servicesLoading
                ? [...Array(2)].map((_, i) => <div key={i} className="skeleton h-12 w-full" />)
                : services?.map((service) => (
                    <div
                      key={service.name}
                      className="bg-base-200 flex items-center justify-between rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        {service.status === 'healthy' ? (
                          <LuCircleCheck className="text-success h-5 w-5" />
                        ) : service.status === 'degraded' ? (
                          <LuCircleAlert className="text-warning h-5 w-5" />
                        ) : (
                          <LuCircleAlert className="text-error h-5 w-5" />
                        )}
                        <div>
                          <p className="font-medium">{service.name}</p>
                          <p className="text-base-content/60 text-sm">
                            {service.latency ? `${service.latency}ms` : 'N/A'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          service.status === 'healthy'
                            ? 'badge-success'
                            : service.status === 'degraded'
                              ? 'badge-warning'
                              : 'badge-error'
                        }`}>
                        {service.status}
                      </span>
                    </div>
                  ))}
            </div>
          </div>

          {/* Table Sizes */}
          <div className="bg-base-100 rounded-box border-base-300 border p-5">
            <h2 className="mb-4 text-lg font-semibold">Database Tables</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Rows</th>
                  </tr>
                </thead>
                <tbody>
                  {tablesLoading
                    ? [...Array(6)].map((_, i) => (
                        <tr key={i}>
                          <td>
                            <div className="skeleton h-4 w-24" />
                          </td>
                          <td>
                            <div className="skeleton h-4 w-16" />
                          </td>
                        </tr>
                      ))
                    : tableSizes?.map((table) => (
                        <tr key={table.table}>
                          <td>
                            <code className="bg-base-200 rounded px-2 py-1 text-sm">
                              {table.table}
                            </code>
                          </td>
                          <td>{table.rows.toLocaleString()}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-base-content/60 text-center text-sm">
            <LuClock className="mr-1 inline h-4 w-4" />
            Last checked: {services?.[0]?.lastCheck ? formatTime(services[0].lastCheck) : '-'}
          </div>
        </div>
      </AdminLayout>
    </>
  )
}
