import { twMerge } from '@utils/twMerge'
import type { MouseEvent, ReactNode } from 'react'

import { TOC_CLASSES } from './tocClasses'

type TocRowProps = {
  headingId: string
  className?: string
  titleClassName?: string
  /** Chat open for this heading — daisyUI `menu-active` */
  isActive?: boolean
  /** Scroll-spy — daisyUI `menu-focus` when not also chat-open */
  isFocused?: boolean
  title: string
  /** Shown in placeholder ink when `title` is blank, like the editor's empty-heading hint. */
  titleLabel?: string
  density?: 'desktop' | 'mobile'
  leading?: ReactNode
  trail?: ReactNode
  onTitleClick: (e: MouseEvent) => void
  titleHref: string
}

/**
 * Menu item shell: leading | title | trail as three grid children so daisyUI
 * `.menu li > *` owns layout (no flex override). Shared by heading rows + desktop header.
 */
export function TocRow({
  headingId,
  className,
  titleClassName,
  isActive,
  isFocused,
  title,
  titleLabel,
  density = 'desktop',
  leading,
  trail,
  onTitleClick,
  titleHref
}: TocRowProps) {
  const blank = !title.trim()
  return (
    <div
      className={twMerge(
        TOC_CLASSES.row,
        'group min-w-0',
        density === 'mobile' ? 'min-h-11' : 'min-h-8',
        isActive && 'menu-active',
        !isActive && isFocused && 'menu-focus',
        className
      )}
      data-id={headingId}>
      {/* Always three grid children so menu’s auto column lands on the title. */}
      <span className="flex min-h-5 shrink-0 items-center">{leading}</span>
      <a
        className={twMerge(
          TOC_CLASSES.rowLink,
          'min-w-0 text-pretty hyphens-auto whitespace-normal text-inherit no-underline'
        )}
        href={titleHref}
        data-id={headingId}
        onClick={onTitleClick}>
        <span
          className={twMerge(
            TOC_CLASSES.link,
            titleClassName,
            blank && titleLabel && 'text-[var(--pad-placeholder-ink)]'
          )}>
          {blank ? titleLabel : title}
        </span>
      </a>
      {trail ?? <span />}
    </div>
  )
}
