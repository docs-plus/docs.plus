/** README gallery URLs, layout, and embed opts for `cypress/docs/readme-gallery.cy.ts`. */

import type { ReadmeGalleryTheme } from '@docs.plus/playground/cypress/readmeGallery'

import { getLoomVideoId } from '../../src/nodes/loom/helper'

export const README_MEDIA_BASE = '/readme-media'

export function readmeMediaUrl(file: string): string {
  return `${README_MEDIA_BASE}/${file}`
}

export const README_IMAGE = readmeMediaUrl('sample.png')
export const README_VIDEO = readmeMediaUrl('sample.mp4')
export const README_AUDIO = readmeMediaUrl('sample.ogg')

export const README_YOUTUBE = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'
export const README_VIMEO = 'https://vimeo.com/76979871'
export const README_SOUNDCLOUD = 'https://soundcloud.com/forss/flickermood'
export const README_LOOM = 'https://www.loom.com/share/e5b8c04bca094dd8a5507925ab887002'
/** Derived via production `getLoomVideoId` — must match Loom share URL above. */
export const README_LOOM_EMBED_ID = (() => {
  const id = getLoomVideoId(README_LOOM)
  if (!id) throw new Error(`Invalid Loom share URL for README gallery: ${README_LOOM}`)
  return id
})()
export const README_X = 'https://x.com/jack/status/20'

export const README_GALLERY_WIDTH = 480
export const README_GALLERY_VIDEO_HEIGHT = 270
/** Loom oEmbed is 4:3; 16:9 gallery height scrolls the iframe. */
export const README_GALLERY_LOOM_HEIGHT = 360
export const README_GALLERY_IMAGE_WIDTH = 332
export const README_GALLERY_IMAGE_HEIGHT = 332

/** HTMLMediaElement.HAVE_CURRENT_DATA — decoded frame, not metadata-only. */
export const README_MEDIA_HAVE_CURRENT_DATA = 2

export const README_GALLERY_TOOLBAR_SETTLE_MS = 250
/** After loading shell clears — local video/audio decode a frame, not just metadata. */
export const README_GALLERY_LOCAL_MEDIA_SETTLE_MS = 750
export const README_GALLERY_EMBED_SETTLE_MS = 800
export const README_GALLERY_LOOM_SETTLE_MS = 2500
/** SoundCloud widget chrome needs a beat longer than other iframe embeds. */
export const README_GALLERY_SOUNDCLOUD_SETTLE_MS = 1200
/** widgets.js paint after oEmbed (see CONTRIBUTING). */
export const README_GALLERY_X_WIDGETS_SETTLE_MS = 6000
/** Loom oEmbed can exceed the default loading-shell command timeout. */
export const README_GALLERY_LOOM_READY_TIMEOUT_MS = 30000

export const README_GALLERY_LAYOUT = {
  display: 'block',
  margin: '0 auto'
} as const

export function readmeGalleryLayout(
  width = README_GALLERY_WIDTH,
  height: number = README_GALLERY_VIDEO_HEIGHT
) {
  return { ...README_GALLERY_LAYOUT, width, height }
}

export const README_IMAGE_GALLERY_LAYOUT = readmeGalleryLayout(
  README_GALLERY_IMAGE_WIDTH,
  README_GALLERY_IMAGE_HEIGHT
)

export const README_LOOM_GALLERY_OPTS = {
  hideEmbedTopBar: true,
  hideTitle: true,
  hideOwner: true,
  hideShare: true
} as const

export function readmeGalleryXLayout(theme: ReadmeGalleryTheme) {
  return {
    ...README_GALLERY_LAYOUT,
    maxwidth: README_GALLERY_WIDTH,
    theme
  }
}
