import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useState } from 'react'
import { LuActivity, LuCircleAlert, LuPlug, LuUsers } from 'react-icons/lu'

import { SectionCard } from '@/components/cards/SectionCard'
import { StatCard } from '@/components/cards/StatCard'
import { TrendAreaChart } from '@/components/charts/TrendAreaChart'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { fetchMcpUsage } from '@/services/api'
import type { McpUsage } from '@/types'
import { formatDate } from '@/utils/format'

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

const CLIENTS_PAGE_SIZE = 20

const DAY_CHOICES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7d' },
  { days: 30, label: '30d' }
]

// The server masks 1 to 4 people as '<5'; this only labels it.
const formatCallers = (count: McpUsage['callers']): string =>
  count === '<5' ? 'Fewer than 5' : count.toLocaleString()

interface ToolRow {
  tool: string
  ok: number
  toolError: number
  rateLimited: number
  error: number
}

function toToolRows(tools: McpUsage['tools']): ToolRow[] {
  const rows = new Map<string, ToolRow>()
  for (const { tool, outcome, calls } of tools) {
    const row = rows.get(tool) ?? { tool, ok: 0, toolError: 0, rateLimited: 0, error: 0 }
    if (outcome === 'ok') row.ok += calls
    else if (outcome === 'tool-error') row.toolError += calls
    else if (outcome === 'rate-limited') row.rateLimited += calls
    else row.error += calls
    rows.set(tool, row)
  }
  return [...rows.values()].sort((a, b) => a.tool.localeCompare(b.tool))
}

type DayRow = McpUsage['days'][number]
type AppRow = McpUsage['apps'][number]
type ClientRow = NonNullable<McpUsage['registeredApps']>[number]

const toolColumns = [
  {
    key: 'tool',
    header: 'Tool',
    render: (row: ToolRow) => <code className="text-sm">{row.tool}</code>
  },
  { key: 'ok', header: 'OK' },
  { key: 'toolError', header: 'Refused' },
  { key: 'rateLimited', header: 'Rate limited' },
  { key: 'error', header: 'Failed' }
]

const dayColumns = [
  { key: 'day', header: 'Day (UTC)' },
  { key: 'calls', header: 'Calls', render: (row: DayRow) => row.calls.toLocaleString() },
  { key: 'callers', header: 'People', render: (row: DayRow) => formatCallers(row.callers) }
]

const appColumns = [
  { key: 'name', header: 'App' },
  { key: 'calls', header: 'Calls', render: (row: AppRow) => row.calls.toLocaleString() }
]

// Name and origins come from whoever registered the client: plain text, never links.
const clientColumns = [
  { key: 'name', header: 'App' },
  {
    key: 'createdAt',
    header: 'Registered',
    className: 'whitespace-nowrap',
    render: (row: ClientRow) => formatDate(row.createdAt)
  },
  {
    key: 'redirectOrigins',
    header: 'Redirect origins',
    render: (row: ClientRow) => (
      <span className="text-base-content/70 text-sm break-all">
        {row.redirectOrigins.join(', ') || '-'}
      </span>
    )
  }
]

export default function McpUsagePage() {
  const [days, setDays] = useState(7)
  const [clientPage, setClientPage] = useState(1)
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'mcp', 'usage', days],
    queryFn: () => fetchMcpUsage(days)
  })

  const totalCalls = data?.days.reduce((sum, day) => sum + day.calls, 0) ?? 0
  const failedCalls =
    data?.tools.filter((t) => t.outcome === 'error').reduce((sum, t) => sum + t.calls, 0) ?? 0
  const clientRowKey = (row: ClientRow) => `${row.createdAt}-${row.name}`
  const clients = data?.registeredApps ?? []

  return (
    <>
      <Head>
        <title>MCP Usage | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="MCP Usage"
          subtitle="Tool calls from connected AI apps. Counts only, kept 35 days."
          onRefresh={() => refetch()}
          refreshing={isRefetching}
        />

        <div className="space-y-6 p-6">
          <div className="join">
            {DAY_CHOICES.map((choice) => (
              <button
                key={choice.days}
                className={`join-item btn btn-sm ${days === choice.days ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDays(choice.days)}>
                {choice.label}
              </button>
            ))}
          </div>

          {error && (
            <div role="alert" className="alert alert-error">
              <LuCircleAlert className="h-5 w-5" />
              <span>{error instanceof Error ? error.message : 'Failed to load MCP usage.'}</span>
            </div>
          )}
          {data && !data.available && (
            <div role="alert" className="alert alert-warning">
              <LuCircleAlert className="h-5 w-5" />
              <span>The server has no Redis, so it keeps no counts.</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Tool calls"
              value={totalCalls}
              icon={<LuActivity className="h-6 w-6" />}
              loading={isLoading}
            />
            <StatCard
              title="People"
              value={formatCallers(data?.callers ?? 0)}
              icon={<LuUsers className="h-6 w-6" />}
              loading={isLoading}
            />
            <StatCard
              title="Failed calls"
              value={failedCalls}
              icon={<LuCircleAlert className="h-6 w-6" />}
              loading={isLoading}
            />
            <StatCard
              title="Registered apps"
              value={data?.registeredApps?.length ?? '-'}
              icon={<LuPlug className="h-6 w-6" />}
              loading={isLoading}
            />
          </div>

          <SectionCard className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Calls per day</h2>
            <TrendAreaChart
              data={data?.days ?? []}
              xKey="day"
              series={[
                {
                  yKey: 'calls',
                  label: 'Calls',
                  color: 'var(--color-primary)',
                  gradientId: 'colorMcpCalls'
                }
              ]}
              emptyMessage="No tool calls yet"
              loading={isLoading}
              height={240}
            />
            <div className="mt-4">
              <DataTable
                columns={dayColumns}
                data={[...(data?.days ?? [])].reverse()}
                loading={isLoading}
                rowKey={(row) => row.day}
              />
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
            <SectionCard className="p-5">
              <h2 className="mb-4 text-lg font-semibold">By tool</h2>
              <DataTable
                columns={toolColumns}
                data={toToolRows(data?.tools ?? [])}
                loading={isLoading}
                rowKey={(row) => row.tool}
                emptyMessage="No tool calls in this window"
              />
            </SectionCard>
            <SectionCard className="p-5">
              <h2 className="mb-4 text-lg font-semibold">By app</h2>
              <DataTable
                columns={appColumns}
                data={data?.apps ?? []}
                loading={isLoading}
                rowKey={(row) => row.name}
                emptyMessage="No tool calls in this window"
              />
            </SectionCard>
          </div>

          <SectionCard className="p-5">
            <h2 className="mb-4 text-lg font-semibold">Registered apps</h2>
            {data && data.registeredApps === null ? (
              <p className="text-base-content/60 text-sm">
                Supabase Auth could not list the apps right now.
              </p>
            ) : (
              <DataTable
                columns={clientColumns}
                data={clients.slice(
                  (clientPage - 1) * CLIENTS_PAGE_SIZE,
                  clientPage * CLIENTS_PAGE_SIZE
                )}
                loading={isLoading}
                pagination={{
                  page: clientPage,
                  totalPages: Math.ceil(clients.length / CLIENTS_PAGE_SIZE),
                  total: clients.length,
                  pageSize: CLIENTS_PAGE_SIZE,
                  onPageChange: setClientPage
                }}
                rowKey={clientRowKey}
                emptyMessage="No apps registered"
              />
            )}
          </SectionCard>
        </div>
      </AdminLayout>
    </>
  )
}
