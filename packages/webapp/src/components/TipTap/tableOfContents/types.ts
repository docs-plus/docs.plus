export interface TocHeading {
  id: string
  level: number
  text: string
  isActive?: boolean
  isScrolledPast?: boolean
}

export interface HeadingActionHandlers {
  onScrollTo: (id: string) => void
  onOpenChat: (id: string) => void
  onToggleFold: (id: string) => void
  onFocusSection: (id: string) => void
  onCopyLink: (id: string) => void
  onDelete: (id: string) => void
}
