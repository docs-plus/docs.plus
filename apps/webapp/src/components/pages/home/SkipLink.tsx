/** `not-sr-only` zeroes padding and height, so focus puts back the `btn-sm` 32px box. */
export const skipLinkClassName =
  'btn btn-primary btn-sm sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:h-8 focus:px-3'

export function SkipLink({ targetId }: { targetId: string }) {
  return (
    <a href={`#${targetId}`} className={skipLinkClassName}>
      Skip to main content
    </a>
  )
}
