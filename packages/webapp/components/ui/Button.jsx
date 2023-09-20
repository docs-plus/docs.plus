import React from 'react'
import PropTypes from 'prop-types'
import { twMerge } from 'tailwind-merge'

const Button = React.forwardRef(
  ({ children, style, onClick, loading = false, className = '', Icon, iconSize }, ref) => (
    <button
      ref={ref}
      className={twMerge(
        'w-full text-center flex justify-center items-center px-4 py-2 leading-6 border rounded-md transition ease-in-out duration-150',
        className
      )}
      disabled={loading}
      style={style}
      type="button"
      onClick={onClick}>
      {loading ? (
        <React.Fragment>
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              fill="currentColor"
            />
          </svg>
          Processing...
        </React.Fragment>
      ) : (
        <React.Fragment>
          {Icon && (
            <span className="w-1/12">
              <Icon size={iconSize} />
            </span>
          )}
          <span className="w-11/12">{children}</span>
        </React.Fragment>
      )}
    </button>
  )
)

Button.propTypes = {
  children: PropTypes.node.isRequired,
  style: PropTypes.object,
  onClick: PropTypes.func,
  loading: PropTypes.bool,
  className: PropTypes.string,
  Icon: PropTypes.elementType,
  iconSize: PropTypes.number
}

Button.displayName = 'Button'

export default Button
