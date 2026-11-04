import { Icons } from '@components/icons/registry'
import { hasMod } from '@docs.plus/extension-hyperlink'
import { twMerge } from '@utils/twMerge'
import type { MouseEvent, ReactNode } from 'react'
import type { IconType } from 'react-icons'

import { linkTextMismatch } from './linkTextMismatch'

/** The glyph size on both link hovercards. */
export const ICON_SIZE = 16

/** One padded block of a card. `second` is the band under the hairline. */
export const Band = ({
  children,
  second,
  busy,
  className
}: {
  children: ReactNode
  second?: boolean
  busy?: boolean
  className?: string
}) => (
  <div
    aria-busy={busy || undefined}
    className={twMerge(
      'flex min-w-0 flex-col gap-1 p-3',
      second && 'border-base-300 border-t',
      className
    )}>
    {children}
  </div>
)

export const Note = ({ children }: { children: ReactNode }) => (
  <p className="text-meta text-base-content/70">{children}</p>
)

/** A plain line, never a live region: one inside the card would reload the editor's embeds. */
export function LinkTextWarning({ text, href }: { text: string; href: string }) {
  const mismatch = linkTextMismatch(text, href)
  if (!mismatch) return null
  return (
    <p className="text-meta flex items-start gap-2 text-[var(--warning-ink)]">
      <Icons.alert size={ICON_SIZE} aria-hidden className="mt-0.5 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        The text says {mismatch.says}, but this link opens{' '}
        <span className="font-semibold">{mismatch.opens}</span>.
      </span>
    </p>
  )
}

/** `newTab` is true for Mod-click and a middle click. */
export function HovercardTitle({
  href,
  children,
  onOpen
}: {
  href: string
  children: ReactNode
  onOpen: (newTab: boolean) => void
}) {
  const openClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    onOpen(hasMod(e))
  }
  const openMiddle = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 1) return
    e.preventDefault()
    onOpen(true)
  }
  return (
    // Tab stays in the editor (it indents there), so no card control joins the Tab order.
    <a
      href={href}
      tabIndex={-1}
      onClick={openClick}
      onAuxClick={openMiddle}
      className="text-base-content line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere] hover:underline">
      {children}
    </a>
  )
}

export function HovercardFacts({
  facts,
  className
}: {
  facts: { Icon: IconType; text: string }[]
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'text-meta text-base-content/70 flex flex-wrap gap-x-3 gap-y-1',
        className
      )}>
      {facts.map(({ Icon, text }) => (
        <span key={text} className="inline-flex min-w-0 items-center gap-1">
          <Icon size={ICON_SIZE} aria-hidden className="shrink-0" />
          {text}
        </span>
      ))}
    </div>
  )
}
