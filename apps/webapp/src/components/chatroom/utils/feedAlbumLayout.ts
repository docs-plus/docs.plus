/**
 * FeedAlbumLayout + FeedColumnWidth — geometry and column contract for feed albums.
 * Paths/MIME/insert stay in messageMediaPaths; tile packing in chatMediaVisualLayout
 * (+ feedAlbumProportionLayout / feedAlbumRowPacker).
 */

export const CHAT_MEDIA_FEED_MAX_WIDTH_PX = 400
export const CHAT_MEDIA_FEED_MAX_WIDTH_MOBILE_PX = 560
/** Desktop host ceiling — keep in lockstep with CHAT_MEDIA_FEED_MAX_WIDTH_PX. */
export const CHAT_MEDIA_MAX_WIDTH_CLASS = 'max-w-[min(400px,100%)]'
export const CHAT_MEDIA_MAX_WIDTH_MOBILE_CLASS = 'max-w-full'
export const CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX = 360
export const CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX = 280
export const CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_SINGLE_PX = 360
export const CHAT_MEDIA_PLACEHOLDER_ASPECT = 16 / 9
export const CHAT_MEDIA_MOSAIC_GAP_PX = 2

/** FeedColumnWidth — mobile media-only card (definite width for absolute tiles). */
export const FEED_COLUMN_MEDIA_CARD_CLASS = 'w-full max-w-[92%] min-w-0'
/** FeedColumnWidth — bubble fill so %/shrink-to-fit does not collapse the album. */
export const FEED_COLUMN_BUBBLE_FILL_CLASS = 'w-full'

const FEED_COLUMN_MIN_MEASURE_PX = 160

export type FeedLayoutVariant = 'mobile' | 'desktop'

export type FeedLayoutOptions = {
  widthCap: number
  maxHeight: number
  widthClass: string
}

/** Pure cap policy — desktop vs mobile single vs mobile mosaic. */
export function resolveFeedLayoutOptions(
  variant: FeedLayoutVariant,
  visualCount: number
): FeedLayoutOptions {
  if (variant === 'desktop') {
    return {
      widthCap: CHAT_MEDIA_FEED_MAX_WIDTH_PX,
      maxHeight: CHAT_MEDIA_FEED_MAX_HEIGHT_DESKTOP_PX,
      widthClass: CHAT_MEDIA_MAX_WIDTH_CLASS
    }
  }
  return {
    widthCap: CHAT_MEDIA_FEED_MAX_WIDTH_MOBILE_PX,
    maxHeight:
      visualCount <= 1
        ? CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_SINGLE_PX
        : CHAT_MEDIA_FEED_MAX_HEIGHT_MOBILE_PX,
    widthClass: CHAT_MEDIA_MAX_WIDTH_MOBILE_CLASS
  }
}

/** DOM measure adapter for FeedColumnWidth — prefer bubble interior, else feed. */
export function resolveFeedColumnElement(host: HTMLElement): HTMLElement | null {
  const bubble = host.closest('.chat-bubble') as HTMLElement | null
  if (bubble && bubble.clientWidth >= FEED_COLUMN_MIN_MEASURE_PX) return bubble
  return (host.closest('.message-feed') as HTMLElement | null) ?? host.parentElement
}

export function clampFeedColumnWidth(rawClientWidth: number, widthCap: number): number {
  const raw = rawClientWidth > 0 ? Math.floor(rawClientWidth) : widthCap
  return Math.max(FEED_COLUMN_MIN_MEASURE_PX, Math.min(widthCap, raw))
}
