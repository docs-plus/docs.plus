import { twMerge } from 'tailwind-merge'

type FeedOverlayProps = {
  className?: string
}

/** Feed tile spoiler veil (token ink on card surfaces). */
export function FeedSpoilerRevealOverlay({ className }: FeedOverlayProps) {
  return (
    <span
      className={twMerge(
        'bg-base-content/35 text-base-100 absolute inset-0 flex items-center justify-center text-xs font-medium',
        className
      )}>
      Tap to reveal
    </span>
  )
}

type GalleryOverlayProps = {
  className?: string
  /** Pill chip for unresolved skeleton; full veil when media is painted. */
  variant?: 'veil' | 'chip'
}

/** Lightbox spoiler cue — fixed black/white on media-anchored stage. */
export function GallerySpoilerRevealOverlay({ className, variant = 'veil' }: GalleryOverlayProps) {
  if (variant === 'chip') {
    return (
      <span
        className={twMerge(
          'rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white',
          className
        )}>
        Tap to reveal
      </span>
    )
  }

  return (
    <span
      className={twMerge(
        'absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white',
        className
      )}>
      Tap to reveal
    </span>
  )
}
