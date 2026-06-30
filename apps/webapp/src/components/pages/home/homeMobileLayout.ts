/** Matches Tailwind `max-sm` — landing keyboard UX applies only below this width. */
export const HOME_MOBILE_MQ = '(max-width: 639px)'

export const HOME_SLUG_INPUT_ID = 'home-slug-input'

/** Shared motion-safe duration for landing region transitions (pair with `homeRegionEase`). */
export const HOME_REGION_DURATION = 'motion-safe:duration-[var(--motion-region)]'

/** Direction-aware easing: collapsing accelerates away, expanding decelerates into place. */
export function homeRegionEase(compact: boolean): string {
  return compact
    ? 'motion-safe:ease-[var(--motion-ease-exit)]'
    : 'motion-safe:ease-[var(--motion-ease-enter)]'
}

export function isHomeMobileLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(HOME_MOBILE_MQ).matches
}
