import { Icons } from '@icons'
import type { IconType } from 'react-icons'
import { LuFilePlus, LuPencil } from 'react-icons/lu'
import { SiModelcontextprotocol } from 'react-icons/si'

import { MCP_GUIDE_URL } from '../constants'
import { type McpServerStatus, useMcpServerStatus } from '../hooks/useMcpServerStatus'
import SettingsCard from './SettingsCard'

const ABILITIES: { icon: IconType; label: string }[] = [
  { icon: Icons.search, label: 'Read documents you can open' },
  { icon: LuFilePlus, label: 'Create documents' },
  { icon: LuPencil, label: 'Edit and chat in your documents' }
]

// "Online" means only that this browser reached the service; never say healthy or connected.
const STATUS: Record<McpServerStatus, { dot: string; label: string }> = {
  checking: { dot: '', label: 'Checking' },
  online: { dot: 'status-success', label: 'Online' },
  offline: { dot: 'status-warning', label: "You're offline" },
  unreachable: { dot: 'status-error', label: 'Unreachable' }
}

const ServerStatus = () => {
  const { dot, label } = STATUS[useMcpServerStatus()]
  return (
    <span role="status" className="text-base-content/60 inline-flex items-center gap-1.5 text-xs">
      <span aria-hidden className={`status ${dot}`} />
      <span className="sr-only">MCP server </span>
      {label}
    </span>
  )
}

const McpIntroCard = () => (
  <SettingsCard>
    <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
      <SiModelcontextprotocol size={20} className="text-primary" aria-hidden />
      <h2 className="text-base-content text-base font-semibold">MCP server</h2>
      <ServerStatus />
      <a
        href={MCP_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="link link-primary ms-auto inline-flex items-center gap-1 text-sm no-underline hover:underline">
        Setup guide
        <Icons.externalLink size={12} aria-hidden />
      </a>
    </div>
    <p className="text-base-content/70 text-sm">
      Connect an AI app such as Claude or ChatGPT. Signed in as you, it can:
    </p>
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {ABILITIES.map(({ icon: Icon, label }) => (
        <li key={label} className="badge badge-soft badge-sm gap-1.5">
          <Icon size={12} className="text-primary shrink-0" aria-hidden />
          {label}
        </li>
      ))}
    </ul>
  </SettingsCard>
)

export default McpIntroCard
