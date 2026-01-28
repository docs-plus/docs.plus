import React, { ButtonHTMLAttributes, forwardRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { IconType } from 'react-icons'

/**
 * daisyUI Button sizes
 * @see https://daisyui.com/components/button/
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

/**
 * daisyUI Button color variants
 */
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

/**
 * daisyUI Button style modifiers
 */
export type ButtonStyle = 'outline' | 'dash' | 'soft'

/**
 * daisyUI Button shape modifiers
 */
export type ButtonShape = 'wide' | 'block' | 'square' | 'circle'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button color variant
   * @default undefined (uses default daisyUI btn styling)
   */
  variant?: ButtonVariant
  /**
   * Button style modifier (outline, dash, soft)
   * Only applies to colored variants, not ghost/link
   */
  btnStyle?: ButtonStyle
  /**
   * Button size
   * @default 'md'
   */
  size?: ButtonSize
  /**
   * Button shape modifier
   */
  shape?: ButtonShape
  /**
   * Whether the button is in a loading state
   * @default false
   */
  loading?: boolean
  /**
   * Text to display while loading (optional)
   */
  loadingText?: string
  /**
   * Icon component to display before children
   */
  startIcon?: IconType | React.ReactNode
  /**
   * Icon component to display after children
   */
  endIcon?: IconType | React.ReactNode
  /**
   * Size of the icon (only works with IconType)
   * @default 16 for xs/sm, 18 for md, 20 for lg/xl
   */
  iconSize?: number
  /**
   * Additional CSS classes
   */
  className?: string
}

/**
 * Get icon size based on button size
 */
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

/**
 * Build daisyUI button class string
 */
const buildButtonClasses = (
  variant?: ButtonVariant,
  btnStyle?: ButtonStyle,
  size?: ButtonSize,
  shape?: ButtonShape
): string => {
  const classes: string[] = ['btn']

  // Add size class
  if (size) {
    classes.push(`btn-${size}`)
  }

  // Add variant class
  if (variant) {
    classes.push(`btn-${variant}`)
  }

  // Add style class (only for colored variants, not ghost/link)
  if (btnStyle && variant && !['ghost', 'link'].includes(variant)) {
    classes.push(`btn-${btnStyle}`)
  }

  // Add shape class
  if (shape) {
    classes.push(`btn-${shape}`)
  }

  return classes.join(' ')
}

/**
 * Render icon (supports both IconType and ReactNode)
 */
const renderIcon = (
  icon: IconType | React.ReactNode | undefined,
  iconSize: number
): React.ReactNode => {
  if (!icon) return null

  // Check if it's an IconType (function component)
  if (typeof icon === 'function') {
    const IconComponent = icon as IconType
    return <IconComponent size={iconSize} />
  }

  // Otherwise, render as ReactNode
  return icon
}

/**
 * Button component following strict daisyUI styling rules.
 *
 * Uses ONLY daisyUI classes - no custom heights, shadows, or arbitrary Tailwind.
 *
 * @example
 * // Basic usage
 * <Button>Click me</Button>
 *
 * // Primary button
 * <Button variant="primary">Submit</Button>
 *
 * // Outline style
 * <Button variant="primary" btnStyle="outline">Cancel</Button>
 *
 * // With icons
 * <Button variant="primary" startIcon={MdSave}>Save</Button>
 *
 * // Loading state
 * <Button loading>Saving...</Button>
 *
 * // All sizes: xs, sm, md, lg, xl
 * <Button size="lg" variant="primary">Large Button</Button>
 *
 * // All variants: neutral, primary, secondary, accent, info, success, warning, error, ghost, link
 * // All styles: outline, dash, soft
 * // All shapes: wide, block, square, circle
 *
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
      type = 'button',
      ...props
    },
    ref
  ) => {
    const buttonClasses = buildButtonClasses(variant, btnStyle, size, shape)
    const resolvedIconSize = iconSize ?? getDefaultIconSize(size)

    return (
      <button
        ref={ref}
        type={type}
        className={twMerge(buttonClasses, className)}
        disabled={disabled || loading}
        {...props}>
        {loading ? (
          loadingText ? (
            <span className="flex items-center gap-2">
              <span className="loading loading-spinner loading-sm" />
              <span>{loadingText}</span>
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
  }
)

Button.displayName = 'Button'

export default Button
