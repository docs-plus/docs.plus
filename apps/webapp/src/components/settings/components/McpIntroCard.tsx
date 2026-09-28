import { AppMark, AppTile } from '@components/ui/AppMark'
import { DocsPlusIcon, Icons } from '@icons'
import type { AiAppId } from '@utils/aiAppBrands'
import type { IconType } from 'react-icons'
import { LuFilePlus, LuShieldCheck } from 'react-icons/lu'

import SettingsCard from './SettingsCard'

const HERO_APPS: AiAppId[] = ['claude', 'chatgpt', 'cursor', 'vscode']

const ABILITIES: { icon: IconType; title: string; body: string }[] = [
  { icon: Icons.search, title: 'Find and read', body: 'Any document you can open.' },
  { icon: LuFilePlus, title: 'Create and edit', body: 'New documents, and documents you own.' },
  {
    icon: Icons.chatroom,
    title: 'Join the chat',
    body: 'Read heading chats, and post in documents you own.'
  },
  {
    icon: LuShieldCheck,
    title: 'You stay in control',
    body: 'You allow each connection, and can disconnect it here.'
  }
]

const McpIntroCard = () => (
  <SettingsCard className="overflow-hidden p-0 sm:p-0">
    <div className="bg-primary/5 border-base-300 border-b p-4 sm:p-6">
      <div className="flex items-center gap-3" aria-hidden>
        <AppTile>
          <DocsPlusIcon size={20} />
        </AppTile>
        <Icons.link size={16} className="text-base-content/40" />
        <span className="flex gap-1.5">
          {HERO_APPS.map((app) => (
            <AppMark key={app} app={app} />
          ))}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base-content text-lg font-semibold">
          Let AI agents work on your documents
        </h2>
        <span className="badge badge-sm badge-soft badge-primary">MCP server</span>
      </div>
      <p className="text-base-content/70 mt-2 max-w-prose text-sm">
        docs.plus runs an MCP server. MCP, the Model Context Protocol, is the open standard that AI
        apps use to connect to other tools. Connect Claude, ChatGPT or a coding agent, and it can
        work on your documents for you, signed in as you.
      </p>
    </div>

    <div className="p-4 sm:p-6">
      <ul className="grid gap-4 sm:grid-cols-2">
        {ABILITIES.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex items-start gap-3">
            <span className="bg-base-200 text-base-content/70 rounded-field flex size-8 shrink-0 items-center justify-center">
              <Icon size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-base-content text-sm font-medium">{title}</p>
              <p className="text-base-content/60 text-xs">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </SettingsCard>
)

export default McpIntroCard
