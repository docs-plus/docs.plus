import { twMerge } from '@utils/twMerge'
import type { HTMLAttributes, ReactNode } from 'react'

export interface ListGroupLabelProps extends HTMLAttributes<HTMLElement> {
  /** The element: a heading in a nav, `li` inside a list, `div` inside a listbox. */
  as?: 'p' | 'div' | 'span' | 'li' | 'h2' | 'h3' | 'h4'
  children: ReactNode
}

/** The one group label for lists, menus and pickers: 13/600 at `/60`, sentence case. */
export function ListGroupLabel({
  as: Tag = 'p',
  className,
  children,
  ...rest
}: ListGroupLabelProps) {
  return (
    <Tag className={twMerge('text-meta text-base-content/60 font-semibold', className)} {...rest}>
      {children}
    </Tag>
  )
}
