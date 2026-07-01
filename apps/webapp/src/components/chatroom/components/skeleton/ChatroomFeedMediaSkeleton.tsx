import { twMerge } from 'tailwind-merge'

/** Pale accent block — doc-style skeleton hint for rich content (media, embeds). */
export function AccentBlockSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge(
        'skeleton h-10 w-full max-w-[12rem] rounded-md',
        'bg-[color-mix(in_oklch,var(--color-info)_20%,var(--color-base-300))]',
        className
      )}
      aria-hidden
    />
  )
}

/** Wider accent panel — single image / gallery placeholder. */
export function AccentPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={twMerge(
        'skeleton h-[4.5rem] w-full max-w-[min(320px,88%)] rounded-lg',
        'bg-[color-mix(in_oklch,var(--color-info)_18%,var(--color-base-300))]',
        className
      )}
      aria-hidden
    />
  )
}
