import { twMerge } from '@utils/twMerge'
import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'

import {
  ContextMenuRow,
  contextMenuRowHostClassName,
  type ContextMenuRowVariant
} from './ContextMenu'

export interface ContextMenuRowButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'onClick' | 'type'
> {
  icon?: ReactNode
  children: ReactNode
  variant?: ContextMenuRowVariant
  /** End slot of the inner `ContextMenuRow`, such as the check on a selected option. */
  trailing?: ReactNode
  /** Merged onto the inner `ContextMenuRow`, such as `min-h-12` or a done-state ink. */
  rowClassName?: string
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
}

/**
 * A `ContextMenuRow` as a plain button, for panels that mix rows with other controls and so
 * cannot use `MenuItem`. It keeps the `MenuItem` focus look; `group` feeds the row's fill.
 */
export function ContextMenuRowButton({
  icon,
  children,
  variant = 'default',
  disabled = false,
  trailing,
  rowClassName,
  ...rest
}: ContextMenuRowButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={twMerge(contextMenuRowHostClassName, 'w-full text-left')}
      {...rest}>
      <ContextMenuRow
        icon={icon}
        variant={variant}
        disabled={disabled}
        trailing={trailing}
        className={rowClassName}>
        {children}
      </ContextMenuRow>
    </button>
  )
}
