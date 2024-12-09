import React from 'react'
import PropTypes from 'prop-types'
import { twMerge } from 'tailwind-merge'

const Button = React.forwardRef(
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
      ...props
    }: any,
    ref
  ) => (
    <button
      ref={ref as React.RefObject<HTMLButtonElement>}
      className={twMerge('btn flex flex-row items-center justify-center antialiased', className)}
      disabled={loading}
      style={style}
      type="button"
      onClick={onClick}
      {...props}>
      {loading ? (
        loadingText ? (
          <span className="flex items-center">
            <span>{loadingText}</span>
            <span className="loading loading-dots loading-xs ml-2 mt-2"></span>
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

Button.propTypes = {
  children: PropTypes.node,
  style: PropTypes.object,
  onClick: PropTypes.func,
  loading: PropTypes.bool,
  className: PropTypes.string,
  Icon: PropTypes.elementType,
  iconSize: PropTypes.number,
  iconFill: PropTypes.string
}

Button.displayName = 'Button'

export default Button
