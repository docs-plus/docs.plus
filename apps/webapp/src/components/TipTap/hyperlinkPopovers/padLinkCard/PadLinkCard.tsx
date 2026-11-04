import { Icons } from '@components/icons/registry'
import CopyButton from '@components/ui/CopyButton'
import { hasMod } from '@docs.plus/extension-hyperlink'
import { twMerge } from '@utils/twMerge'
import type { MouseEvent, ReactNode } from 'react'
import type { IconType } from 'react-icons'

import type { CardFactIcon, CardView } from './model'

const FACT_ICON: Record<CardFactIcon, IconType> = {
  sections: Icons.listTree,
  messages: Icons.thread,
  date: Icons.calendar,
  replies: Icons.reply,
  reactions: Icons.emoji,
  versions: Icons.history
}

// Same origin as the app, so no icon route and no third party (CSP img-src 'self').
const LOGO_SRC = '/icons/logo.svg'
const ICON_SIZE = 16

/** Host, then path, query and hash, decoded for reading. The copy keeps the raw href. */
const linkParts = (href: string): { host: string; rest: string } => {
  try {
    const url = new URL(href, window.location.origin)
    const raw = `${url.pathname}${url.search}${url.hash}`
    let rest = raw
    try {
      rest = decodeURI(raw)
    } catch {
      // A malformed escape stays as written.
    }
    return { host: url.host, rest: rest === '/' ? '' : rest }
  } catch {
    return { host: href, rest: '' }
  }
}

/** `second` is the band under the hairline: what is inside, after what and where. */
const Band = ({
  children,
  busy,
  second
}: {
  children: ReactNode
  busy?: boolean
  second?: boolean
}) => (
  <div
    aria-busy={busy || undefined}
    className={twMerge('flex min-w-0 flex-col gap-1 p-3', second && 'border-base-300 border-t')}>
    {children}
  </div>
)

const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-meta text-base-content/70">{children}</p>
)

const Bone = ({ className }: { className: string }) => (
  <div className="flex h-5 items-center">
    <div className={`skeleton ${className}`} />
  </div>
)

type Props = {
  href: string
  view: CardView
  /** `newTab` is true for Mod-click, a middle click and the Open button. */
  onOpen: (newTab: boolean) => void
}

/** The docs.plus link hovercard body: the approved board, in house tokens. */
export function PadLinkCard({ href, view, onOpen }: Props) {
  const { host, rest } = linkParts(href)

  const openTitle = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onOpen(hasMod(e))
  }
  const openMiddle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 1) return
    e.preventDefault()
    onOpen(true)
  }

  return (
    <>
      {view.state === 'loading' && (
        <Band busy>
          <Bone className="h-3.5 w-[72%]" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-[58%]" />
        </Band>
      )}
      {view.state === 'empty' && (
        <Band>
          <Note>No preview for this page.</Note>
        </Band>
      )}
      {view.state === 'locked' && (
        <Band>
          <div className="flex min-w-0 items-center gap-2">
            <Icons.lock size={ICON_SIZE} aria-hidden className="text-base-content/70 shrink-0" />
            <span className="text-base-content text-sm font-semibold [overflow-wrap:anywhere]">
              This document is private
            </span>
          </div>
          <Note>Only the owner can open it.</Note>
        </Band>
      )}
      {view.state === 'data' && (
        <>
          <Band>
            {/* Tab stays in the editor (it indents there), so no card control joins the Tab order. */}
            <a
              href={href}
              tabIndex={-1}
              onClick={openTitle}
              onAuxClick={openMiddle}
              className="text-base-content line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] hover:underline">
              {view.title}
            </a>
            {view.crumbs.length > 0 && (
              <div className="text-meta text-base-content/60 flex min-w-0 items-center gap-1 overflow-hidden">
                {view.crumbs.map((crumb, i) => (
                  <span key={i} className="flex min-w-0 shrink items-center gap-1">
                    {i > 0 && (
                      <Icons.chevronRight size={ICON_SIZE} aria-hidden className="shrink-0" />
                    )}
                    <span className="min-w-0 truncate">{crumb}</span>
                  </span>
                ))}
              </div>
            )}
          </Band>
          {(view.facts.length > 0 || view.rail || view.description) && (
            <Band second>
              {view.facts.length > 0 && (
                <div className="text-meta text-base-content/70 flex flex-wrap gap-x-3 gap-y-1">
                  {view.facts.map(({ icon, text }) => {
                    const Icon = FACT_ICON[icon]
                    return (
                      <span key={text} className="inline-flex min-w-0 items-center gap-1">
                        <Icon size={ICON_SIZE} aria-hidden className="shrink-0" />
                        {text}
                      </span>
                    )
                  })}
                </div>
              )}
              {/* `ml-[7px]` centres the rail line under the 16px fact icon. */}
              {view.rail && (
                <ul
                  aria-label="Sections"
                  className="text-meta text-base-content border-base-300 ml-[7px] flex min-w-0 flex-col border-l pl-3">
                  {view.rail.items.map((item, i) => (
                    <li key={i} className="truncate">
                      {item}
                    </li>
                  ))}
                  {view.rail.more > 0 && (
                    <li className="text-base-content/70">+{view.rail.more} more</li>
                  )}
                </ul>
              )}
              {view.description && (
                <p className="text-meta text-base-content/70 line-clamp-2">{view.description}</p>
              )}
            </Band>
          )}
        </>
      )}
      <div className="text-meta border-base-300 flex min-h-10 min-w-0 items-center gap-2 border-t py-1 pr-1 pl-3">
        <img src={LOGO_SRC} alt="" aria-hidden className="size-4 shrink-0 rounded-full" />
        <span className="text-base-content/70 min-w-0 flex-1 truncate">
          <span className="text-base-content">{host}</span>
          {rest}
        </span>
        <CopyButton
          text={href}
          square
          tabIndex={-1}
          label="Copy link"
          successLabel="Link copied"
          successMessage={null}
          className="text-base-content/70 hover:text-base-content shrink-0"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Open in new tab"
          onClick={() => onOpen(true)}
          className="btn btn-ghost btn-sm btn-square text-base-content/70 hover:text-base-content shrink-0">
          <Icons.externalLink size={ICON_SIZE} aria-hidden className="stroke-[1.75]" />
        </button>
      </div>
    </>
  )
}
