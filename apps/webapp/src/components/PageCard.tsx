import { quietActionClassName } from '@components/ui/Button'
import { modalPanelFrameClassName } from '@components/ui/Dialog'
import { DocsPlusIcon } from '@icons'
import { twMerge } from '@utils/twMerge'
import Link from 'next/link'
import type { ReactNode } from 'react'

type FooterStripProps = {
  /** Left side at 13/20 `/70`: an address or a short note. Inline content; it renders in a `p`. */
  meta?: ReactNode
  /** Right side: the ways out, in the quiet P6 ink. */
  actions?: ReactNode
  /** Given, the actions sit in a `nav` with this name. Use it when they are links to other pages. */
  actionsLabel?: string
}

/** The card family's footer strip. Renders nothing without `meta` or `actions`: a strip is never empty. */
export function FooterStrip({ meta, actions, actionsLabel }: FooterStripProps) {
  if (!meta && !actions) return null
  const actionsClassName = 'ml-auto flex flex-wrap gap-x-5'

  return (
    <div className="border-base-300 bg-base-100 text-meta text-base-content/70 flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-6 py-3.5">
      {meta && <p className="min-w-0 flex-auto [overflow-wrap:anywhere]">{meta}</p>}
      {actions &&
        (actionsLabel ? (
          <nav aria-label={actionsLabel} className={actionsClassName}>
            {actions}
          </nav>
        ) : (
          <div className={actionsClassName}>{actions}</div>
        ))}
    </div>
  )
}

/** The way out every page card offers. */
export function HomepageLink() {
  return (
    <Link href="/" className={quietActionClassName}>
      Homepage
    </Link>
  )
}

type PageCardProps = {
  /** The page `h1`: a statement, with no icon above it. */
  title: ReactNode
  description?: ReactNode
  /** Body after the title: an identity group, then one `btn btn-primary btn-block`. */
  children?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
}

/**
 * A full-page card for one task: gates, errors, consent. The brand link sits outside
 * the card on its left edge; the footer strip renders only when `meta` or `actions` is given.
 */
export function PageCard({ title, description, children, meta, actions }: PageCardProps) {
  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--pad-well)] px-4 py-8">
      <div className="flex w-[min(100%,400px)] flex-col gap-4 motion-safe:animate-[doc-region-in_220ms_ease-out_both]">
        <Link
          href="/"
          aria-label="docs.plus home"
          className="text-base-content rounded-field focus-visible:outline-primary inline-flex min-h-10 items-center gap-2 self-start no-underline focus-visible:outline-2 focus-visible:outline-offset-2">
          <DocsPlusIcon size={24} />
          <span className="text-lg font-bold tracking-tight">docs.plus</span>
        </Link>
        <article className={twMerge(modalPanelFrameClassName, 'w-full overflow-hidden')}>
          <div className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-base-content text-xl font-semibold text-balance">{title}</h1>
              {description && <p className="text-base-content/70 text-sm">{description}</p>}
            </div>
            {children}
          </div>
          <FooterStrip meta={meta} actions={actions} actionsLabel="Other pages" />
        </article>
      </div>
    </main>
  )
}

/** The identity group: the only box inside a card. Holds `PageCardIdentityRow`s. */
export function PageCardIdentity({
  children,
  className
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'border-base-300 rounded-field [&>*+*]:border-base-300 border [&>*+*]:border-t',
        className
      )}>
      {children}
    </div>
  )
}

type PageCardIdentityRowProps = {
  /** A 40px avatar or app tile. */
  leading?: ReactNode
  name?: ReactNode
  /** Email, trust line or "Signed in as …" at 13/20 `/70`. */
  meta?: ReactNode
  /** One quiet P6 action, such as "Not you?". */
  action?: ReactNode
}

export function PageCardIdentityRow({ leading, name, meta, action }: PageCardIdentityRowProps) {
  return (
    <div className="flex min-h-16 flex-wrap items-center gap-3 p-3">
      {leading}
      <div className="grid min-w-0 flex-[1_1_140px]">
        {name && (
          <span className="text-base-content text-sm font-semibold [overflow-wrap:anywhere]">
            {name}
          </span>
        )}
        {meta && (
          <span className="text-meta text-base-content/70 [overflow-wrap:anywhere]">{meta}</span>
        )}
      </div>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}
