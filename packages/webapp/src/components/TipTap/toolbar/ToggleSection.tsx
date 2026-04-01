import Toggle from '@components/ui/Toggle'
import { twMerge } from 'tailwind-merge'

interface ToggleSectionProps {
  name: string
  className?: string
  description: string
  /** Optional stable id for the underlying checkbox (`htmlFor` / accessibility). */
  toggleId?: string
  checked: boolean
  onChange: () => void
}

const ToggleSection = ({
  name,
  className,
  description,
  toggleId,
  checked,
  onChange
}: ToggleSectionProps) => {
  return (
    <div className={twMerge('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-base-content text-sm font-medium">{name}</p>
        <p className="text-base-content/50 text-xs">{description}</p>
      </div>
      <Toggle
        id={toggleId}
        checked={checked}
        onChange={() => onChange()}
        size="sm"
        variant="primary"
      />
    </div>
  )
}

export default ToggleSection
