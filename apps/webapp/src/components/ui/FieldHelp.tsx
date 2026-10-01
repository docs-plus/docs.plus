import { Icons } from '@icons'
import { twMerge } from '@utils/twMerge'
import type { HTMLAttributes } from 'react'

/** The label above a field: `text-meta` in full ink. */
export const fieldLabelClassName = 'text-meta text-base-content font-semibold'

export interface FieldHelpProps extends HTMLAttributes<HTMLParagraphElement> {
  /** Renders the error line: error ink led by a 16px alert glyph. */
  error?: boolean
  success?: boolean
}

// Plain `p`, not daisyUI `label`: that class sets `white-space: nowrap`, so help could not wrap.
export function FieldHelp({ error, success, className, children, ...rest }: FieldHelpProps) {
  if (error) {
    return (
      <p {...rest} className={twMerge('text-meta text-error flex items-start gap-1.5', className)}>
        <Icons.alert size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>{children}</span>
      </p>
    )
  }

  return (
    <p
      {...rest}
      className={twMerge(
        'text-meta text-base-content/60',
        success && 'text-[var(--success-ink)]',
        className
      )}>
      {children}
    </p>
  )
}
