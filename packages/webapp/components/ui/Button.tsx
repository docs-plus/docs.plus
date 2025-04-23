import React, { ButtonHTMLAttributes, MouseEventHandler } from 'react'
import { twMerge } from 'tailwind-merge'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Additional CSS classes to apply to the button */
  className?: string
  /** Custom style object */
  style?: React.CSSProperties
  /** Click handler for the button */
  onClick?: any
  /** Whether the button is in a loading state */
  loading?: boolean
  /** Text to display while loading */
  loadingText?: string
  /** Icon component to display */
  Icon?: React.ComponentType<{ size?: number; fill?: string }>
  /** Size of the icon */
  iconSize?: number
  /** Fill color of the icon */
  iconFill?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children = null,
      style,
      onClick,
      loading = false,
      className = '',
      Icon,
      iconSize,
      iconFill,
      loadingText = null,
      type = 'button',
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      className={twMerge('btn flex flex-row items-center justify-center antialiased', className)}
      disabled={loading}
      style={style}
      type={type}
      onClick={onClick}
      {...props}>
      {loading ? (
        loadingText ? (
          <span className="flex items-center">
            <span>{loadingText}</span>
            <span className="loading loading-dots loading-xs mt-2 ml-2"></span>
          </span>
        ) : (
          <span className="loading loading-spinner"></span>
        )
      ) : (
        <>
          {Icon && (
            <span className={`${!children ? 'w-12/12' : 'w-1/12'}`}>
              <Icon size={iconSize} fill={iconFill} />
            </span>
          )}
          {children}
        </>
      )}
    </button>
  )
)

Button.displayName = 'Button'

export default Button
