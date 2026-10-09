import { twMerge } from '@utils/twMerge'

/** Accent panel that stands in for a single image or a gallery. */
export function AccentPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge(
        'skeleton rounded-field h-[4.5rem] w-full max-w-[min(320px,88%)]',
        'bg-[color-mix(in_oklch,var(--color-info)_18%,var(--color-base-300))]',
        className
      )}
      aria-hidden
    />
  )
}
