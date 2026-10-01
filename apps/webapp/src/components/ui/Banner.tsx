import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'
import type { ReactNode } from 'react'
import type { IconType } from 'react-icons'

export type BannerTone = 'info' | 'warning' | 'error'

// Literal classes: Tailwind cannot see an interpolated `alert-${tone}`.
const TONE: Record<BannerTone, { alert: string; glyph: string; icon: IconType }> = {
  info: { alert: 'alert-info', glyph: 'text-info', icon: Icons.info },
  warning: { alert: 'alert-warning', glyph: 'text-warning', icon: Icons.alert },
  error: { alert: 'alert-error', glyph: 'text-error', icon: Icons.alert }
}

export interface BannerProps {
  tone: BannerTone
  /** Optional 14/600 lead line. */
  title?: ReactNode
  children?: ReactNode
  /** At most two quiet actions: `Button variant="quiet"` or `quietActionClassName` links. */
  actions?: ReactNode
  /** Overrides the tone glyph, for a status that has its own sign (for example offline). */
  icon?: IconType
  /** Defaults to `alert` for errors and `status` otherwise. Use `note` for a static notice. */
  role?: 'status' | 'alert' | 'note'
  className?: string
}

/**
 * The inline alert: soft tone fill, 16px status glyph first, text in base ink for contrast.
 * Flex-wrap, not the alert grid: on a phone the actions drop under the text instead of
 * squeezing it into a narrow column.
 */
export function Banner({ tone, title, children, actions, icon, role, className }: BannerProps) {
  const toneRecipe = TONE[tone]
  const Glyph = icon ?? toneRecipe.icon

  return (
    <div
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      className={twMerge(
        'alert alert-soft flex flex-wrap items-start gap-x-4 gap-y-1 px-3 py-2 text-sm',
        toneRecipe.alert,
        className
      )}>
      <Glyph size={16} aria-hidden className={twMerge('mt-0.5 shrink-0', toneRecipe.glyph)} />
      <div className="text-base-content flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
      {actions ? (
        <div className="ms-auto flex shrink-0 items-center gap-4 self-center">{actions}</div>
      ) : null}
    </div>
  )
}
