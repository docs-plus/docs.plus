import useCopyToClipboard from '@hooks/useCopyToClipboard'
import { Icons } from '@icons'
import { AI_APP_BRANDS } from '@utils/aiAppBrands'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'
import { LuSparkles } from 'react-icons/lu'

import { agentCommands, agentSetupPrompt } from '../utils/agentSetup'
import { mcpServerUrl } from '../utils/mcpServerUrl'

// The whole cell copies, so the swap glyph is a picture of the state, like CopyButton's.
const AgentCell = ({
  mark,
  name,
  detail,
  text,
  title,
  label,
  className
}: {
  mark: ReactNode
  name: string
  detail: ReactNode
  text: string
  /** The full command on hover; the prompt cell leaves it out. */
  title?: string
  label: string
  className?: string
}) => {
  const { copy, copied } = useCopyToClipboard({ successMessage: null })
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      title={title}
      aria-label={copied ? 'Copied' : label}
      className={twMerge(
        'group bg-base-100 hover:bg-base-200 focus-visible:outline-primary flex min-w-0 items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2',
        className
      )}>
      {mark}
      <span className="min-w-0 flex-1">
        <span className="text-base-content block text-sm font-semibold">{name}</span>
        {detail}
      </span>
      <span
        aria-hidden
        className={twMerge(
          'swap text-base-content/40 group-hover:text-base-content/70',
          copied && 'swap-active'
        )}>
        <Icons.check size={16} className="swap-on stroke-[1.75] text-[var(--success-ink)]" />
        <Icons.copy size={16} className="swap-off stroke-[1.75]" />
      </span>
    </button>
  )
}

/** One copy per terminal agent, then a prompt for any other agent. Desktop only: a phone runs none. */
const AgentSetupGrid = () => {
  const serverUrl = mcpServerUrl()
  // The consent page lives on this site, so its host is the one the person must check.
  const prompt = agentSetupPrompt(
    serverUrl,
    typeof window === 'undefined' ? 'docs.plus' : window.location.host
  )

  return (
    <div className="border-base-300 mt-4 border-t pt-4">
      <p className="text-base-content text-sm font-semibold">Set up from a terminal agent</p>
      <p className="text-meta text-base-content/60">
        Copy the line for your agent. It asks before it changes anything.
      </p>
      {/* gap-px over a base-300 fill draws every divider, at any column count. */}
      <div className="border-base-300 bg-base-300 rounded-box mt-3 grid grid-cols-1 gap-px overflow-hidden border sm:grid-cols-2">
        {agentCommands(serverUrl).map(({ app, name, command, hint }) => {
          const { component: Mark, color } = AI_APP_BRANDS[app]
          return (
            <AgentCell
              key={app}
              mark={
                <Mark
                  size={22}
                  aria-hidden
                  className="shrink-0"
                  style={color ? { color } : undefined}
                />
              }
              name={name}
              detail={
                <code className="text-base-content/60 block truncate font-mono text-xs">
                  {hint}
                </code>
              }
              text={command}
              title={command}
              label={`Copy the ${name} command`}
            />
          )
        })}
        <AgentCell
          className="sm:col-span-2"
          mark={
            <span
              aria-hidden
              className="bg-base-200 border-base-300 rounded-field text-primary flex size-[22px] shrink-0 items-center justify-center border">
              <LuSparkles size={14} />
            </span>
          }
          name="Any other agent"
          detail={
            <span className="text-base-content/60 block text-xs">
              Copy a prompt it can follow, such as in Warp, Kiro or OpenCode
            </span>
          }
          text={prompt}
          label="Copy a setup prompt for any other agent"
        />
      </div>
      <p className="text-meta text-base-content/60 mt-3">
        Then start sign-in in your agent, for example <code className="font-mono">/mcp</code> in
        Claude Code. On the page that opens, check that it says{' '}
        <span className="text-base-content font-medium">an app on this computer</span>, then choose{' '}
        <span className="text-base-content font-medium">Allow</span>.
      </p>
    </div>
  )
}

export default AgentSetupGrid
