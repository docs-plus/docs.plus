import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

import Button from './Button'

export type EmptyStateLayout = 'pane' | 'inline'
export type EmptyStateTone = 'neutral' | 'error'

export interface EmptyStateProps {
  /** A statement that ends with a period, for example "No bookmarks here." */
  title: string
  body?: ReactNode
  /** `pane` only: an optional bare 24px glyph. The error tone draws its own glyph. */
  icon?: IconType
  /** One action, for example Clear on a filtered list. */
  action?: ReactNode
  /** A failed load: renders the quiet Try again in the action slot. */
  onRetry?: () => void
  retrying?: boolean
  /** `pane`: a whole panel or pane, centred at `py-8`. `inline`: inside a card, left-aligned. */
  layout?: EmptyStateLayout
  tone?: EmptyStateTone
  className?: string
}

export function EmptyState({
  title,
  body,
  icon: Icon,
  action,
  onRetry,
  retrying,
  layout = 'pane',
  tone = 'neutral',
  className
}: EmptyStateProps) {
  const isPane = layout === 'pane'
  const isError = tone === 'error'
  const PaneGlyph = isError ? Icons.alert : Icon

  return (
    <div
      role={isError ? 'alert' : undefined}
      className={twMerge(
        'flex flex-col gap-3 motion-safe:animate-[doc-content-in_180ms_ease-out_both]',
        isPane ? 'items-center px-4 py-8 text-center' : 'items-start py-2',
        className
      )}>
      {isPane && PaneGlyph && (
        <PaneGlyph
          size={24}
          aria-hidden
          className={isError ? 'text-error shrink-0' : 'text-base-content/50 shrink-0'}
        />
      )}
      <div className={twMerge('flex flex-col gap-1', isPane && 'items-center')}>
        <p className="text-base-content flex items-start gap-1.5 text-sm font-semibold">
          {!isPane && isError && (
            <Icons.alert size={16} aria-hidden className="text-error mt-0.5 shrink-0" />
          )}
          <span>{title}</span>
        </p>
        {body ? <p className="text-base-content/60 text-sm">{body}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="quiet" loading={retrying} onClick={() => onRetry()}>
          Try again
        </Button>
      ) : (
        action
      )}
    </div>
  )
}
