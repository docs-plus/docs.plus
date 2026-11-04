import { Icons } from '@components/icons/registry'
import type { IconType } from 'react-icons'

import { Band, HovercardFacts, HovercardTitle, ICON_SIZE, Note } from '../HovercardParts'
import type { CardFactIcon, CardView } from './model'

const FACT_ICON: Record<CardFactIcon, IconType> = {
  sections: Icons.listTree,
  messages: Icons.thread,
  date: Icons.calendar,
  replies: Icons.reply,
  reactions: Icons.emoji,
  versions: Icons.history
}

type Props = {
  href: string
  view: CardView
  /** `newTab` is true for Mod-click and a middle click. */
  onOpen: (newTab: boolean) => void
}

/** The docs.plus link hovercard body: the approved board, in house tokens. */
export function PadLinkCard({ href, view, onOpen }: Props) {
  if (view.state === 'locked') {
    return (
      <Band>
        <div className="flex min-w-0 items-center gap-2">
          <Icons.lock size={ICON_SIZE} aria-hidden className="text-base-content/70 shrink-0" />
          <span className="text-base-content text-sm font-semibold [overflow-wrap:anywhere]">
            This document is private
          </span>
        </div>
        <Note>Only the owner can open it.</Note>
      </Band>
    )
  }

  return (
    <>
      <Band>
        <HovercardTitle href={href} onOpen={onOpen}>
          {view.title}
        </HovercardTitle>
        {view.crumbs.length > 0 && (
          <div className="text-meta text-base-content/60 flex min-w-0 items-center gap-1 overflow-hidden">
            {view.crumbs.map((crumb, i) => (
              <span key={i} className="flex min-w-0 shrink items-center gap-1">
                {i > 0 && <Icons.chevronRight size={ICON_SIZE} aria-hidden className="shrink-0" />}
                <span className="min-w-0 truncate">{crumb}</span>
              </span>
            ))}
          </div>
        )}
      </Band>
      {(view.facts.length > 0 || view.rail || view.description) && (
        <Band second>
          {view.facts.length > 0 && (
            <HovercardFacts
              facts={view.facts.map(({ icon, text }) => ({ Icon: FACT_ICON[icon], text }))}
            />
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
  )
}
