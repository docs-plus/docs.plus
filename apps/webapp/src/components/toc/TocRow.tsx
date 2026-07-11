import type { MouseEvent, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

import { TOC_CLASSES } from './tocClasses'

type TocRowProps = {
  headingId: string
  className?: string
  isActive?: boolean
  depth?: number
  /** Desktop default min-h-8; pass min-h-11 on mobile */
  density?: 'desktop' | 'mobile'
  leading?: ReactNode
  title: ReactNode
  trail?: ReactNode
  onTitleClick: (e: MouseEvent) => void
  titleHref: string
}

/** Shared docked row shell. Desktop owns DnD outside; mobile omits grip/presence. */
export function TocRow({
  headingId,
  className,
  isActive,
  depth = 0,
  density = 'desktop',
  leading,
  title,
  trail,
  onTitleClick,
  titleHref
}: TocRowProps) {
  return (
    <div
      className={twMerge(
        TOC_CLASSES.row,
        'group rounded-field relative flex items-start gap-1 overflow-hidden py-1 pr-3',
        density === 'mobile' ? 'min-h-11' : 'min-h-8',
        isActive && `active ${TOC_CLASSES.activeBorder} bg-base-300`,
        className
      )}
      data-id={headingId}
      data-depth={depth}>
      {leading}
      <a
        className={twMerge(
          TOC_CLASSES.rowLink,
          'min-w-0 flex-1 text-pretty hyphens-auto whitespace-normal text-inherit no-underline'
        )}
        href={titleHref}
        data-id={headingId}
        onClick={onTitleClick}>
        {title}
      </a>
      {trail}
    </div>
  )
}
