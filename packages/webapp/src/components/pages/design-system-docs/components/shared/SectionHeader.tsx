/**
 * SectionHeader Component
 * =======================
 * Consistent section headers for documentation.
 */

import { IconType } from 'react-icons'

interface SectionHeaderProps {
  id: string
  title: string
  description?: string
  icon?: IconType
}

export const SectionHeader = ({ id, title, description, icon: Icon }: SectionHeaderProps) => {
  return (
    <div id={id} className="mb-6 scroll-mt-20">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="bg-primary/10 flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Icon className="text-primary size-5" />
          </div>
        )}
        <div>
          <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="mt-4 h-px bg-slate-200" />
    </div>
  )
}
