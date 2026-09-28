import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import CopyButton from '@components/ui/CopyButton'
import { useMemo, useState } from 'react'
import { LuPlug, LuPlugZap, LuShieldCheck } from 'react-icons/lu'

import { useConnectedApps } from '../hooks/useConnectedApps'
import { useDisconnectApp } from '../hooks/useDisconnectApp'
import { openDisconnectAppConfirm } from '../openDisconnectAppConfirm'
import type { ConnectedAppGroup, ConnectRow, ConnectRowAction } from '../types'
import { connectRows } from '../utils/connectRows'
import { formatShortDate } from '../utils/formatShortDate'
import { isMobileSurface } from '../utils/isMobileSurface'
import { mcpServerUrl } from '../utils/mcpServerUrl'
import SettingsCard from './SettingsCard'

const RowAction = ({ action }: { action: ConnectRowAction }) =>
  action.kind === 'link' ? (
    <a href={action.href} className="btn btn-primary btn-sm shrink-0">
      {action.label}
    </a>
  ) : (
    <CopyButton
      text={action.text}
      label={action.label}
      successLabel="Copied"
      successMessage={null}
      variant="soft"
      className="shrink-0"
    />
  )

const RowNote = ({ row }: { row: ConnectRow }) => {
  if (!row.link) return row.note
  const [before, after] = row.note.split(row.link.text)
  return (
    <>
      {before}
      <a href={row.link.href} target="_blank" rel="noopener noreferrer" className="link">
        {row.link.text}
      </a>
      {after}
    </>
  )
}

const ConnectRowItem = ({ row, showAction }: { row: ConnectRow; showAction: boolean }) => (
  <li className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
    <span
      aria-hidden
      className="bg-base-200 rounded-field text-base-content/70 flex size-9 shrink-0 items-center justify-center text-xs font-bold">
      {row.mark}
    </span>
    <div className="min-w-[12rem] flex-1">
      <p className="text-base-content text-sm font-semibold">
        {row.name}{' '}
        {row.where && <span className="text-base-content/60 text-xs font-normal">{row.where}</span>}
      </p>
      <p className="text-base-content/70 mt-0.5 text-xs">
        <RowNote row={row} />
      </p>
      {showAction && row.command && (
        <code
          title={row.command}
          className="bg-base-200 border-base-300 rounded-field text-base-content mt-1.5 block truncate border px-2 py-1.5 font-mono text-xs">
          {row.command}
        </code>
      )}
    </div>
    {showAction && row.action && <RowAction action={row.action} />}
  </li>
)

const ConnectCard = () => {
  const [isPhone] = useState(() => typeof window !== 'undefined' && isMobileSurface())
  const serverUrl = mcpServerUrl()
  const rows = useMemo(
    () =>
      connectRows(serverUrl)
        .filter((row) => (isPhone ? !row.desktopOnly : !row.phoneOnly))
        .map((row) => (isPhone ? { ...row, ...row.phone } : row)),
    [serverUrl, isPhone]
  )

  return (
    <SettingsCard>
      <div className="mb-3 flex items-center gap-2">
        <LuPlug size={20} className="text-primary" />
        <h2 className="text-base-content text-base font-semibold">Connect an AI app</h2>
      </div>
      <p className="text-base-content/60 text-xs sm:text-sm">
        Use your documents from Claude, ChatGPT and other AI apps. You approve each app once, on a
        docs.plus page.
      </p>

      <div className="border-primary/20 bg-primary/5 rounded-box mt-4 flex items-start gap-3 border p-4">
        <LuShieldCheck size={20} className="text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-base-content text-sm font-medium">What a connected app can do</p>
          <p className="text-base-content/70 mt-1 text-xs sm:text-sm">
            Read the documents you can open. Edit and post in chat only in documents you own.
          </p>
        </div>
      </div>

      <label htmlFor="mcp-server-url" className="text-base-content mt-4 block text-sm font-medium">
        Server URL
      </label>
      <div className="mt-1.5 flex gap-2">
        <input
          id="mcp-server-url"
          readOnly
          value={serverUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="input input-sm min-w-0 flex-1 font-mono text-xs"
        />
        <CopyButton
          text={serverUrl}
          label="Copy"
          successLabel="Copied"
          successMessage={null}
          variant="soft"
          className="shrink-0"
        />
      </div>

      <ul className="border-base-300 rounded-box divide-base-300 mt-4 divide-y border">
        {rows.map((row) => (
          <ConnectRowItem key={row.name} row={row} showAction={!isPhone} />
        ))}
      </ul>

      <p className="text-base-content/60 mt-4 text-xs">
        {isPhone &&
          'Add Claude on the web or in Claude Desktop. It then works in the Claude phone app too. '}
        A docs.plus page opens once for each app. Check the app name and the{' '}
        <span className="text-base-content font-medium">Sends you back to</span> address, then
        choose <span className="text-base-content font-medium">Approve</span>.
      </p>
    </SettingsCard>
  )
}

const ConnectedAppRow = ({ group }: { group: ConnectedAppGroup }) => {
  const { mutateAsync, isPending } = useDisconnectApp()

  // mutateAsync, not mutate: the row unmounts when the list refetches, and mutate's callbacks die with it.
  const disconnect = async () => {
    try {
      await mutateAsync({ clientIds: group.clientIds })
      toast.Success('App disconnected')
    } catch {
      toast.Error(`Could not disconnect ${group.name}. Try again.`)
    }
  }

  const connections = group.clientIds.length

  return (
    <li className="flex flex-wrap items-center gap-3 p-3 sm:p-4">
      <div className="min-w-[12rem] flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-base-content min-w-0 truncate text-sm font-semibold">
            <bdi>{group.name}</bdi>
          </p>
          <span className="badge badge-sm badge-soft badge-warning shrink-0">Unverified app</span>
        </div>
        <p className="text-base-content/60 mt-0.5 text-xs">
          Connected on {formatShortDate(group.grantedAt)}
          {connections > 1 && ` · ${connections} connections`}
        </p>
      </div>
      <Button
        variant="error"
        btnStyle="outline"
        size="sm"
        loading={isPending}
        disabled={isPending}
        aria-label={`Disconnect ${group.name}`}
        onClick={() => openDisconnectAppConfirm({ name: group.name, onConfirm: disconnect })}
        className="shrink-0">
        Disconnect
      </Button>
    </li>
  )
}

const ConnectedCard = () => {
  const { data: apps, isPending, isError, isFetching, refetch } = useConnectedApps()

  let body: React.ReactNode
  if (isPending) {
    body = (
      <ul
        aria-busy
        aria-label="Loading connected apps"
        className="border-base-300 rounded-box divide-base-300 divide-y border">
        {[0, 1].map((i) => (
          <li key={i} className="flex items-center gap-3 p-3 sm:p-4">
            <div className="flex-1 space-y-1.5">
              <div className="skeleton rounded-field h-4 w-40" />
              <div className="skeleton rounded-field h-3 w-28" />
            </div>
            <div className="skeleton rounded-field h-8 w-24" />
          </li>
        ))}
      </ul>
    )
  } else if (isError) {
    body = (
      <div role="alert" className="flex flex-col items-center justify-center py-10 text-center">
        <p className="text-base-content text-sm font-medium">Could not load connected apps</p>
        <Button
          size="sm"
          variant="ghost"
          loading={isFetching}
          disabled={isFetching}
          className="border-base-300 mt-4 border"
          onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  } else if (apps.length === 0) {
    body = (
      <div className="flex flex-col items-center py-6 text-center">
        <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
          <LuPlug size={22} className="text-base-content/40" />
        </div>
        <p className="text-base-content/70 text-sm">No apps are connected.</p>
      </div>
    )
  } else {
    body = (
      <>
        <ul className="border-base-300 rounded-box divide-base-300 divide-y border">
          {apps.map((group) => (
            <ConnectedAppRow key={group.name} group={group} />
          ))}
        </ul>
        <p className="text-base-content/60 mt-3 text-xs">
          Disconnect revokes the app's access. The app may keep what it already read. Also remove
          docs.plus in the app.
        </p>
      </>
    )
  }

  return (
    <SettingsCard>
      <div className="mb-3 flex items-center gap-2">
        <LuPlugZap size={20} className="text-primary" />
        <h2 className="text-base-content text-base font-semibold">Connected</h2>
      </div>
      <p className="text-base-content/60 mb-4 text-xs sm:text-sm">
        Apps that can use your docs.plus account right now.
      </p>
      {body}
    </SettingsCard>
  )
}

const ConnectedAppsSection = () => (
  <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
    <ConnectCard />
    <ConnectedCard />
  </div>
)

export default ConnectedAppsSection
