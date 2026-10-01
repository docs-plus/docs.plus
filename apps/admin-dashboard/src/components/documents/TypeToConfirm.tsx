import { clsx } from 'clsx'
import { useId } from 'react'

interface TypeToConfirmProps {
  expected: string
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}

/**
 * The typed-slug gate of the delete dialogs. A plain label, because the daisyUI 5 `.label`
 * is `nowrap` and a long slug would push past the dialog edge.
 */
export function TypeToConfirm({
  expected,
  value,
  onChange,
  onSubmit,
  disabled
}: TypeToConfirmProps) {
  const id = useId()
  const matches = value === expected

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-semibold">
        Type <kbd className="kbd kbd-sm h-auto max-w-full break-all">{expected}</kbd> to confirm
        deletion
      </label>
      <input
        id={id}
        type="text"
        className={clsx(
          'input w-full font-mono',
          value && !matches && 'input-error',
          matches && 'input-success'
        )}
        placeholder={expected}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  )
}
