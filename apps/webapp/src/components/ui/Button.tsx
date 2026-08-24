import { Placement } from '@floating-ui/react'
import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { IconType } from 'react-icons'
import { twMerge } from 'tailwind-merge'

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

export type ButtonStyle = 'outline' | 'dash' | 'soft'

export type ButtonShape = 'wide' | 'block' | 'square' | 'circle'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** outline / dash / soft — colored variants only, not ghost/link */
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
  const classes: string[] = ['btn']

  if (size) {
    classes.push(`btn-${size}`)
  }

  if (variant) {
    classes.push(`btn-${variant}`)
  }

  if (btnStyle && variant && !['ghost', 'link'].includes(variant)) {
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
 * Uses ONLY daisyUI classes — no custom heights, shadows, or arbitrary Tailwind.
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
    const resolvedIconSize = iconSize ?? getDefaultIconSize(size)

    const button = (
      <button
        ref={ref}
        type={type}
        className={twMerge(buttonClasses, className)}
        disabled={disabled || loading}
        {...props}>
        {loading ? (
          loadingText ? (
            <span className="flex items-center gap-2 motion-safe:animate-[doc-content-in_120ms_ease-out_both]">
              <span className="loading loading-spinner loading-sm" />
              <span>{loadingText}</span>
            </span>
          ) : (
            <span className="loading loading-spinner motion-safe:animate-[doc-content-in_120ms_ease-out_both]" />
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
