import { Placement } from '@floating-ui/react'
import { twMerge } from '@utils/twMerge'
import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { IconType } from 'react-icons'

import { Tooltip } from './Tooltip'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type ButtonVariant =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'ghost'
  | 'link'
  | 'cancel'
  | 'quiet'

export type ButtonStyle = 'outline' | 'dash' | 'soft'

export type ButtonShape = 'wide' | 'block' | 'square' | 'circle'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** `cancel`: the bordered neutral dialog Cancel. `quiet`: the P6 secondary action; no `btn`. */
  variant?: ButtonVariant
  /** outline / dash / soft — colored variants only, not ghost/link/cancel/quiet */
  btnStyle?: ButtonStyle
  size?: ButtonSize
  shape?: ButtonShape
  loading?: boolean
  loadingText?: string
  startIcon?: IconType | React.ReactNode
  endIcon?: IconType | React.ReactNode
  iconSize?: number
  className?: string
  /** Renders a Floating UI Tooltip around the button. */
  tooltip?: string
  tooltipPlacement?: Placement
}

/** P6 secondary ink with a 40px hit area and no fill. Links (`Link`, `<a>`) reuse this string. */
export const quietActionClassName =
  'inline-flex items-center gap-1.5 rounded-field -my-2.5 py-2.5 text-[var(--primary-ink)] text-meta font-semibold cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40'

/** A destructive text action on `variant="ghost"`: error ink, soft error hover. */
export const dangerGhostClassName = 'hover:bg-error/10 text-[var(--error-ink)]'

/**
 * One bordered segment of a choice group (view toggle, media options). In a `join` the cells
 * overlap by 1px; the active cell sits on top so its whole tinted border shows.
 */
export const segmentClassName = (active: boolean): string =>
  active
    ? 'relative z-[1] border bg-primary/10 border-primary/40 text-[var(--primary-ink)]'
    : 'border border-base-300 text-base-content/70'

/**
 * Dialog Cancel: bordered neutral, same height as the primary. It sets daisyUI's vars, not
 * `bg-*`/`text-*`, so the `:disabled` fill and ink still win; the border var beats that rule, so
 * `disabled:` clears it as daisyUI does. `--btn-color` stays unset: it also colours the focus ring.
 */
const cancelClassName =
  '[--btn-bg:var(--color-base-100)] [--btn-border:var(--color-base-300)] hover:[--btn-bg:var(--color-base-200)] disabled:[--btn-border:#0000]'

const getDefaultIconSize = (size?: ButtonSize): number => {
  switch (size) {
    case 'xs':
      return 14
    case 'sm':
      return 16
    case 'lg':
    case 'xl':
      return 20
    default:
      return 18
  }
}

const buildButtonClasses = (
  variant?: ButtonVariant,
  btnStyle?: ButtonStyle,
  size?: ButtonSize,
  shape?: ButtonShape
): string => {
  if (variant === 'quiet') return quietActionClassName

  const classes: string[] = ['btn']

  if (size) {
    classes.push(`btn-${size}`)
  }

  if (variant === 'cancel') {
    classes.push(cancelClassName)
  } else if (variant) {
    classes.push(`btn-${variant}`)
  }

  if (btnStyle && variant && !['ghost', 'link', 'cancel'].includes(variant)) {
    classes.push(`btn-${btnStyle}`)
  }

  if (shape) {
    classes.push(`btn-${shape}`)
  }

  return classes.join(' ')
}

const renderIcon = (
  icon: IconType | React.ReactNode | undefined,
  iconSize: number
): React.ReactNode => {
  if (!icon) return null

  if (typeof icon === 'function') {
    const IconComponent = icon as IconType
    return <IconComponent size={iconSize} />
  }

  return icon
}

/**
 * daisyUI `btn` classes only, plus the house `cancel` and `quiet` recipes. A busy text button
 * keeps its label, with the spinner before it; a busy square or circle shows the spinner alone.
 * @see https://daisyui.com/components/button/
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant,
      btnStyle,
      size,
      shape,
      loading = false,
      loadingText,
      startIcon,
      endIcon,
      iconSize,
      className,
      disabled,
      tooltip,
      tooltipPlacement,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const buttonClasses = buildButtonClasses(variant, btnStyle, size, shape)
    const resolvedIconSize = iconSize ?? (variant === 'quiet' ? 14 : getDefaultIconSize(size))
    // An icon-only square or circle has no room for a spinner beside its glyph.
    const busyLabel =
      loadingText ?? (shape === 'square' || shape === 'circle' ? undefined : children)

    const button = (
      <button
        ref={ref}
        type={type}
        className={twMerge(buttonClasses, className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}>
        {loading ? (
          busyLabel ? (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" aria-hidden />
              <span>{busyLabel}</span>
            </span>
          ) : (
            <span className="loading loading-spinner" />
          )
        ) : (
          <>
            {renderIcon(startIcon, resolvedIconSize)}
            {children}
            {renderIcon(endIcon, resolvedIconSize)}
          </>
        )}
      </button>
    )

    if (!tooltip) return button

    return (
      <Tooltip title={tooltip} placement={tooltipPlacement}>
        {button}
      </Tooltip>
    )
  }
)

Button.displayName = 'Button'

export default Button
