import { AI_APP_BRANDS, type AiAppId } from '@utils/aiAppBrands'
import type { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

/** A square tile for an app's mark: a brand glyph, a letter, or a status icon. */
export const AppTile = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    aria-hidden
    className={twMerge(
      'bg-base-100 border-base-300 rounded-field text-base-content/70 flex size-9 shrink-0 items-center justify-center border text-xs font-bold',
      className
    )}>
    {children}
  </span>
)

export const AppMark = ({
  app,
  size = 20,
  className
}: {
  app: AiAppId
  size?: number
  className?: string
}) => {
  const { component: Icon, color } = AI_APP_BRANDS[app]
  return (
    <AppTile className={twMerge('text-base-content', className)}>
      <Icon size={size} style={color ? { color } : undefined} />
    </AppTile>
  )
}
