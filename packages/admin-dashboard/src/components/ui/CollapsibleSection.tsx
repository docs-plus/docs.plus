import { useState, type ReactNode } from 'react'
import { LuChevronDown, LuChevronRight } from 'react-icons/lu'

interface CollapsibleSectionProps {
  title: string
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  actions?: ReactNode
}

export function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = true,
  actions
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hover:text-primary flex items-center gap-2 text-xl font-semibold transition-colors">
          {isOpen ? (
            <LuChevronDown className="text-base-content/60 h-5 w-5" />
          ) : (
            <LuChevronRight className="text-base-content/60 h-5 w-5" />
          )}
          {icon && <span className="text-primary">{icon}</span>}
          {title}
        </button>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'opacity-100' : 'max-h-0 opacity-0'
        }`}>
        {isOpen && <div className="space-y-6">{children}</div>}
      </div>
    </div>
  )
}
