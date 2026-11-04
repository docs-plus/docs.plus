import type { ReactNode } from 'react'

import { LinkIcon } from './HovercardLinkLine'
import { Band, HovercardTitle } from './HovercardParts'

type Props = {
  href: string
  title: string
  /** The full path, wrapped. The link line says why there is no preview in place of the address. */
  path: string
  /** `newTab` is true for Mod-click and a middle click. */
  onOpen: (newTab: boolean) => void
  /** The link-text warning, when there is one. */
  children?: ReactNode
}

/** The card body for a web link with no preview, or a file: the destination is the card. */
export function NoPreviewCard({ href, title, path, onOpen, children }: Props) {
  return (
    <Band>
      <div className="flex min-w-0 items-center gap-2">
        <LinkIcon href={href} pad={false} className="size-5" />
        <HovercardTitle href={href} onOpen={onOpen}>
          {title}
        </HovercardTitle>
      </div>
      {path && <p className="text-meta text-base-content/70 [overflow-wrap:anywhere]">{path}</p>}
      {children}
    </Band>
  )
}
