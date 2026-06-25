/** Matches Tailwind `max-sm` — landing keyboard UX applies only below this width. */
export const HOME_MOBILE_MQ = '(max-width: 639px)'

export const HOME_SLUG_INPUT_ID = 'home-slug-input'

/** Shared motion-safe duration/easing for landing region transitions. */
export const HOME_REGION_MOTION_EASE =
  'motion-safe:duration-[var(--motion-region)] motion-safe:ease-out'

export function isHomeMobileLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(HOME_MOBILE_MQ).matches
}

export function isHomeSlugInput(target: EventTarget | null): boolean {
  return target instanceof Element && target.id === HOME_SLUG_INPUT_ID
}
