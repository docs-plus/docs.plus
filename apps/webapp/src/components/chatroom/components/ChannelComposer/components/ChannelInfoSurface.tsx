import type { ComponentType } from 'react'

import { ChannelComposerSurface } from './ChannelComposerSurface'

type Props = {
  icon: ComponentType<{ size?: number; className?: string }>
  message: string
  className?: string
}

export function ChannelInfoSurface({ icon: Icon, message, className }: Props) {
  return (
    <ChannelComposerSurface className={className}>
      <div className="bg-base-300/40 text-base-content/70 flex items-center gap-2 rounded-full px-4 py-2 text-sm">
        <Icon size={14} className="shrink-0" />
        <span>{message}</span>
      </div>
    </ChannelComposerSurface>
  )
}
