import { twMerge } from '@utils/twMerge'
import { useId } from 'react'

import { FieldHelp } from './FieldHelp'
import Toggle from './Toggle'

export interface ToggleRowProps {
  id?: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

/** A settings row: label and help on the left, a small primary switch on the right. */
export function ToggleRow({
  id: idProp,
  label,
  description,
  checked,
  onChange,
  disabled,
  className
}: ToggleRowProps) {
  const generatedId = useId()
  const id = idProp ?? generatedId
  const helpId = `${id}-help`

  return (
    <div className={twMerge('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className={twMerge(
            'text-base-content cursor-pointer text-sm font-medium',
            disabled && 'text-base-content/40 cursor-not-allowed'
          )}>
          {label}
        </label>
        <FieldHelp id={helpId}>{description}</FieldHelp>
      </div>
      <Toggle
        id={id}
        variant="primary"
        size="sm"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-describedby={helpId}
      />
    </div>
  )
}
