import { forwardRef, useId, InputHTMLAttributes } from 'react'
import { twMerge } from 'tailwind-merge'

export type FileInputSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type FileInputColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export interface FileInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Label text for the file input */
  label?: string
  /** Size of the file input */
  size?: FileInputSize
  /** Color variant of the file input */
  color?: FileInputColor
  /** Whether to use ghost style (no border) */
  ghost?: boolean
  /** Helper text displayed below the file input */
  helperText?: string
  /** Error state - shows error styling */
  error?: boolean
  /** Success state - shows success styling */
  success?: boolean
  /** Additional wrapper class */
  wrapperClassName?: string
}

const buildFileInputClasses = (
  size?: FileInputSize,
  color?: FileInputColor,
  ghost?: boolean,
  error?: boolean,
  success?: boolean
): string => {
  const classes: string[] = ['file-input', 'w-full']

  if (size) {
    classes.push(`file-input-${size}`)
  }

  // Priority: error > success > color
  if (error) {
    classes.push('file-input-error')
  } else if (success) {
    classes.push('file-input-success')
  } else if (color) {
    classes.push(`file-input-${color}`)
  }

  if (ghost) {
    classes.push('file-input-ghost')
  }

  return classes.join(' ')
}

const FileInput = forwardRef<HTMLInputElement, FileInputProps>(
  (
    {
      label,
      size,
      color,
      ghost = false,
      helperText,
      error = false,
      success = false,
      wrapperClassName,
      className,
      id: _id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = _id || generatedId

    const fileInputClasses = buildFileInputClasses(size, color, ghost, error, success)

    // Helper text styling
    const helperTextClasses = twMerge(
      'label text-xs',
      error && 'text-error',
      success && 'text-success'
    )

    return (
      <div className={twMerge('form-control w-full', wrapperClassName)}>
        {label && (
          <label htmlFor={id} className="label">
            <span className="label-text text-base-content">{label}</span>
          </label>
        )}
        <input
          ref={ref}
          id={id}
          type="file"
          className={twMerge(fileInputClasses, disabled && 'file-input-disabled', className)}
          disabled={disabled}
          {...props}
        />
        {helperText && <p className={helperTextClasses}>{helperText}</p>}
      </div>
    )
  }
)

FileInput.displayName = 'FileInput'

export default FileInput
