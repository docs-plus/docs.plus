import { useMutation, useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { LuCircleAlert, LuClock, LuInbox, LuMail } from 'react-icons/lu'

import { SectionCard } from '@/components/cards/SectionCard'
import { StatCard } from '@/components/cards/StatCard'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { Header } from '@/components/layout/Header'
import { DataTable } from '@/components/tables/DataTable'
import { fetchEmailSetup, sendTestEmail } from '@/services/api'
import type { EmailSetup, TestSendResult } from '@/types'
import { formatRelative } from '@/utils/format'

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

const STATUS_BADGE: Record<EmailSetup['status'], { className: string; text: string }> = {
  ready: { className: 'badge-success', text: 'Ready' },
  off: { className: 'badge-ghost', text: 'Off' },
  invalid: { className: 'badge-error', text: 'Invalid' }
}

const STATUS_TEXT: Record<EmailSetup['status'], string> = {
  ready: 'Email is set up. Mail goes out.',
  off: 'Email is off. Queued mail is marked skipped.',
  invalid: 'Email is set up wrong. Mail waits until you fix the problems below.'
}

function connectionText(connection: EmailSetup['connection']): string {
  switch (connection.state) {
    case 'ok':
      return connection.note === 'send_only_key' ? 'Connected (send-only key)' : 'Connected'
    case 'failed':
      return `Failed: ${connection.kind} ${connection.code}`
    case 'timeout':
      return 'No answer in time'
    case 'skipped':
      return 'Not checked'
  }
}

interface ValueRow {
  name: string
  value: string
  state?: 'set' | 'missing' | 'invalid'
  /** Derived, not an env var, so it is not shown in code font. */
  derived?: boolean
}

const STATE_BADGE = { set: 'badge-success', missing: 'badge-warning', invalid: 'badge-error' }
const STATE_LABEL = { set: 'Set', missing: 'Missing', invalid: 'Invalid' }

function toValueRows(setup: EmailSetup): ValueRow[] {
  const rows: ValueRow[] = [
    { name: 'EMAIL_PROVIDER', value: setup.provider ?? '-' },
    { name: 'EMAIL_FROM', value: setup.from ?? '-' },
    { name: 'Key namespace', value: setup.namespace ?? '-', derived: true },
    { name: 'PUBLIC_RESTAPI_URL', value: setup.publicUrl ?? '-' },
    { name: 'SMTP_HOST', value: setup.smtp.host ?? '-' },
    { name: 'SMTP_PORT', value: String(setup.smtp.port) }
  ]
  for (const [name, state] of Object.entries(setup.secrets)) {
    rows.push({ name, value: state, state })
  }
  rows.push({
    name: 'RESEND_WEBHOOK_SECRET',
    value: setup.webhook.secret,
    state: setup.webhook.secret
  })
  return rows
}

const valueColumns = [
  {
    key: 'name',
    header: 'Setting',
    render: (row: ValueRow) =>
      row.derived ? (
        <span className="text-sm">{row.name}</span>
      ) : (
        <code className="text-sm">{row.name}</code>
      )
  },
  {
    key: 'value',
    header: 'Value',
    render: (row: ValueRow) =>
      row.state ? (
        <span className={`badge badge-sm ${STATE_BADGE[row.state]}`}>{STATE_LABEL[row.state]}</span>
      ) : (
        <span className="text-sm break-all">{row.value}</span>
      )
  }
]

function testSendAnnouncement(result: TestSendResult | undefined, error: Error | null): string {
  if (error) return error.message
  if (!result) return ''
  return result.sent ? `Sent to ${result.to}.` : `Not sent: ${result.kind} ${result.code}`
}

export default function EmailSetupPage() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['admin', 'email', 'setup'],
    queryFn: ({ signal }) => fetchEmailSetup({ signal })
  })
  const testSend = useMutation({ mutationFn: sendTestEmail })

  const envBlock = data?.envToAdd.join('\n') ?? ''
  const copyEnvBlock = async () => {
    try {
      await navigator.clipboard.writeText(envBlock)
      toast.success('Copied')
    } catch {
      toast.error('Copy failed. Select the lines and copy them.')
    }
  }

  return (
    <>
      <Head>
        <title>Email setup | Admin Dashboard</title>
      </Head>

      <AdminLayout>
        <Header
          title="Email setup"
          subtitle="Read-only. Every value comes from the host env file."
          onRefresh={() => refetch()}
          refreshing={isRefetching}
        />

        <div className="space-y-6 p-6">
          {error && (
            <div role="alert" className="alert alert-error">
              <LuCircleAlert className="h-5 w-5" />
              <span>{error instanceof Error ? error.message : 'Failed to load email setup.'}</span>
            </div>
          )}

          {isLoading && <div className="skeleton rounded-box h-24 w-full" />}

          {data && (
            <>
              <SectionCard className="space-y-2 p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`badge ${STATUS_BADGE[data.status].className}`}>
                    {STATUS_BADGE[data.status].text}
                  </span>
                  <p className="font-medium">{STATUS_TEXT[data.status]}</p>
                </div>
                <p className="text-sm">
                  <span className="text-base-content/60">Connection check: </span>
                  {connectionText(data.connection)}
                </p>
                {data.problems.length > 0 && (
                  <ul className="list-inside list-disc text-sm text-[var(--error-ink)]">
                    {data.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                )}
              </SectionCard>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                  title="Queue pending"
                  value={data.queue.connected ? data.queue.pending : 'No queue'}
                  icon={<LuClock className="h-6 w-6" />}
                />
                <StatCard
                  title="Email DLQ"
                  value={data.queue.dlqDepth ?? '-'}
                  description="Mail that failed for good."
                  icon={<LuInbox className="h-6 w-6" />}
                />
                <SectionCard className="flex flex-col justify-center gap-1 p-5 text-sm">
                  <Link href="/audit/notifications" className="link link-primary">
                    Open the failure summary
                  </Link>
                  <span className="text-base-content/60">
                    It shows the DLQ entries and the worker&apos;s state.
                  </span>
                </SectionCard>
              </div>

              <SectionCard className="p-5">
                <h2 className="mb-4 text-lg font-semibold">Settings</h2>
                <DataTable
                  columns={valueColumns}
                  data={toValueRows(data)}
                  rowKey={(row) => row.name}
                />
              </SectionCard>

              <SectionCard className="space-y-2 p-5">
                <h2 className="text-lg font-semibold">Resend webhook</h2>
                <p className="text-sm">
                  URL:{' '}
                  <code className="break-all">
                    {data.webhook.url ?? 'Set PUBLIC_RESTAPI_URL first'}
                  </code>
                </p>
                <p className="text-sm">
                  {data.webhook.secret === 'set'
                    ? 'The webhook is set up. Bounces and complaints turn email off for that address.'
                    : data.webhook.secret === 'invalid'
                      ? 'RESEND_WEBHOOK_SECRET is invalid, so the route is off. Mail still goes out.'
                      : 'Not set up. Mail still goes out, but bounces are not recorded.'}
                </p>
                <p className="text-base-content/70 text-sm">
                  {data.latestBounce.state === 'found'
                    ? `Newest bounce: ${data.latestBounce.email}, ${data.latestBounce.bounceType}, ${formatRelative(data.latestBounce.bouncedAt)}${data.latestBounce.reason ? ` (${data.latestBounce.reason})` : ''}`
                    : data.latestBounce.state === 'none'
                      ? 'No bounce in the last year.'
                      : 'The bounce list could not be read right now.'}
                </p>
              </SectionCard>

              {data.envToAdd.length > 0 && (
                <SectionCard className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Lines to add</h2>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={copyEnvBlock}>
                      Copy
                    </button>
                  </div>
                  <pre
                    tabIndex={0}
                    aria-label="Lines to add"
                    className="bg-base-200 rounded-field focus-visible:ring-primary overflow-x-auto p-3 text-sm select-all focus-visible:ring-2 focus-visible:outline-none">
                    {envBlock}
                  </pre>
                  <p className="text-base-content/60 text-sm">
                    Fill in the blank values. Edit the host env file, then redeploy.
                  </p>
                </SectionCard>
              )}

              <SectionCard className="space-y-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Test email</h2>
                    <p className="text-base-content/60 text-sm">
                      Sends one email to your own address, once per minute. It runs in rest-api. The
                      worker&apos;s state is in the failure summary.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-2"
                    disabled={testSend.isPending}
                    aria-busy={testSend.isPending}
                    onClick={() => testSend.mutate()}>
                    {testSend.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <LuMail className="h-4 w-4" />
                    )}
                    Send test email
                  </button>
                </div>
                {testSend.data?.sent === true && (
                  <p className="text-sm text-[var(--success-ink)]">
                    Sent to {testSend.data.to}. Message id: <code>{testSend.data.messageId}</code>
                  </p>
                )}
                {testSend.data?.sent === false && (
                  <p className="text-sm text-[var(--error-ink)]">
                    Not sent: {testSend.data.kind} {testSend.data.code}
                  </p>
                )}
                {testSend.error && (
                  <p className="text-sm text-[var(--error-ink)]">{testSend.error.message}</p>
                )}
                {/* Always mounted, so a screen reader announces a result added later. */}
                <p role="status" className="sr-only">
                  {testSendAnnouncement(testSend.data, testSend.error)}
                </p>
              </SectionCard>
            </>
          )}
        </div>
      </AdminLayout>
    </>
  )
}
