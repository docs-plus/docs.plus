import * as toast from '@components/toast'
import { AppMark, AppTile } from '@components/ui/AppMark'
import Button, { dangerGhostClassName } from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import { Icons } from '@icons'
import type { AppTrust, ConnectedAppGroup } from '@utils/appTrust'
import { twMerge } from '@utils/twMerge'
import { LuPlugZap } from 'react-icons/lu'

import { useConnectedApps } from '../hooks/useConnectedApps'
import { useDisconnectApp } from '../hooks/useDisconnectApp'
import { openDisconnectAppConfirm } from '../openDisconnectAppConfirm'
import { appsWithAccessText } from '../utils/appsWithAccessText'
import { formatShortDate } from '../utils/formatShortDate'
import ConnectCard from './ConnectCard'
import McpIntroCard from './McpIntroCard'
import SettingsCard, { SettingsCardHeader } from './SettingsCard'

// A known app needs no badge: its return address, not its name, proves who it is.
const TrustBadge = ({ trust }: { trust: AppTrust }) => {
  if (trust.kind === 'known') return null
  if (trust.kind === 'local') {
    return <span className="badge badge-sm badge-soft shrink-0">On this computer</span>
  }
  return (
    <span className="badge badge-sm badge-soft badge-warning shrink-0 text-[var(--warning-ink)]">
      Unverified app
    </span>
  )
}

// A brand mark only for a verified app: an unverified one could borrow any logo with the name.
const TrustMark = ({ group }: { group: ConnectedAppGroup }) => {
  if (group.trust.kind === 'known') return <AppMark app={group.trust.app} />
  return (
    <AppTile>
      {group.trust.kind === 'local' ? (
        <Icons.monitor size={18} />
      ) : (
        group.name.slice(0, 1).toUpperCase()
      )}
    </AppTile>
  )
}

const ConnectedAppRow = ({ group }: { group: ConnectedAppGroup }) => {
  const { mutateAsync, isPending } = useDisconnectApp()

  // mutateAsync, not mutate: the row unmounts when the list refetches, and mutate's callbacks die with it.
  const disconnect = async () => {
    try {
      await mutateAsync({ clientIds: group.clientIds })
      toast.Success(`${label} disconnected`)
    } catch {
      toast.Error(`Could not disconnect ${label}. Try again.`)
    }
  }

  const connections = group.clientIds.length
  // Two rows can share a name, so the control and dialog name the trust state too.
  const label =
    group.trust.kind === 'known'
      ? group.name
      : `${group.name} (${group.trust.kind === 'local' ? 'on this computer' : 'unverified'})`

  return (
    <li className="flex items-center gap-3 p-3 sm:p-4">
      <TrustMark group={group} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-base-content min-w-0 truncate text-sm font-semibold">
            <bdi>{group.name}</bdi>
          </p>
          <TrustBadge trust={group.trust} />
        </div>
        <p className="text-meta text-base-content/60 mt-0.5">
          {group.trust.kind === 'known' && `Returns you to ${group.trust.host} · `}
          Connected on {formatShortDate(group.grantedAt)}
          {connections > 1 && ` · ${connections} connections`}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        loading={isPending}
        aria-label={`Disconnect ${label}`}
        onClick={() => openDisconnectAppConfirm({ name: label, onConfirm: disconnect })}
        className={twMerge(dangerGhostClassName, 'shrink-0')}>
        Disconnect
      </Button>
    </li>
  )
}

// Hidden until the list loads and while it is empty, so a first visit opens on Add an AI app.
const ConnectedCard = () => {
  const { data: apps, isError, isFetching, refetch } = useConnectedApps()
  if (!isError && !apps?.length) return null

  return (
    <SettingsCard>
      <SettingsCardHeader
        icon={LuPlugZap}
        title="Apps with access"
        description={!isError && apps ? appsWithAccessText(apps.length) : undefined}
      />
      {isError || !apps ? (
        <EmptyState
          layout="inline"
          tone="error"
          title="Couldn’t load connected apps."
          onRetry={refetch}
          retrying={isFetching}
        />
      ) : (
        <ul className="border-base-300 rounded-box divide-base-300 divide-y border">
          {apps.map((group) => (
            <ConnectedAppRow key={group.key} group={group} />
          ))}
        </ul>
      )}
    </SettingsCard>
  )
}

const ConnectedAppsSection = () => (
  <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
    <McpIntroCard />
    <ConnectedCard />
    <ConnectCard />
  </div>
)

export default ConnectedAppsSection
