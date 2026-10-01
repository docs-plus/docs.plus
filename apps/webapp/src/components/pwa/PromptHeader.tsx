import type { IconType } from 'react-icons'
import { LuX } from 'react-icons/lu'

/** The frame shared by the PWA install and notification prompt cards. */
export const promptCardClassName =
  'rounded-box flex flex-col gap-4 px-5 py-4 surface-inverse shadow-xl border-base-300 border'

type PromptHeaderProps = {
  icon: IconType
  title: string
  subtitle: string
  titleId: string
  closeLabel: string
  onClose: () => void
}

export function PromptHeader({
  icon: Icon,
  title,
  subtitle,
  titleId,
  closeLabel,
  onClose
}: PromptHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="rounded-field bg-current/10 p-2">
          <Icon size={24} aria-hidden />
        </div>
        <div>
          <h3 id={titleId} className="text-sm font-semibold">
            {title}
          </h3>
          <p className="text-xs opacity-60">{subtitle}</p>
        </div>
      </div>
      <button
        onClick={onClose}
        className="hover:bg-base-content/10 rounded-field -mt-1 -mr-2 cursor-pointer p-1.5 opacity-60 transition-[opacity,background-color] hover:opacity-100"
        aria-label={closeLabel}>
        <LuX size={16} />
      </button>
    </div>
  )
}
