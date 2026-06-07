const CONTENT_CLASS = /hypermultimedia--([a-z]+)__content/
const GRIPPER_CLASS = 'hypermultimedia__resize-gripper'
const GRIPPER_SELECTOR = `.${GRIPPER_CLASS}`

function queryHTMLElement(root: ParentNode, selector: string): HTMLElement | null {
  const el = root.querySelector(selector)
  return el instanceof HTMLElement ? el : null
}

function queryGripperByKeyId(keyId: string, root: ParentNode): HTMLElement | null {
  return queryHTMLElement(root, `${GRIPPER_SELECTOR}[data-media-key-id="${CSS.escape(keyId)}"]`)
}

function queryMediaByKeyId(keyId: string, root: ParentNode): HTMLElement | null {
  return queryHTMLElement(root, `[data-key-id="${CSS.escape(keyId)}"]`)
}

function isGripper(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.classList.contains(GRIPPER_CLASS)
}

function isMediaWrapper(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement) || isGripper(el)) return false
  if (el.classList.contains('hypermultimedia--image__content')) return true
  if (el.hasAttribute('data-key-id')) return true
  return CONTENT_CLASS.test(el.className)
}

/** Gripper widget for a media wrapper — keyId link first, validated sibling fallback. */
export function findGripperForMedia(
  target: HTMLElement,
  root: ParentNode = document
): HTMLElement | null {
  const keyId = target.getAttribute('data-key-id')
  if (keyId) {
    const linked = queryGripperByKeyId(keyId, root)
    if (linked) return linked
  }
  const prev = target.previousElementSibling
  return isGripper(prev) ? prev : null
}

/** Media wrapper for a gripper widget — keyId link first, validated sibling fallback. */
export function resolveMediaFromGripper(
  gripper: HTMLElement,
  root: ParentNode
): HTMLElement | null {
  const keyId = gripper.dataset.mediaKeyId
  if (keyId) {
    const linked = queryMediaByKeyId(keyId, root)
    if (linked) return linked
  }
  const next = gripper.nextElementSibling
  return isMediaWrapper(next) ? next : null
}

/** Block wrapper or image element that owns resize controls. */
export function findMediaTarget(
  el: HTMLElement | null,
  root: ParentNode = document
): HTMLElement | null {
  if (!el) return null

  const gripper = el.closest(GRIPPER_SELECTOR)
  if (gripper instanceof HTMLElement) {
    const media = resolveMediaFromGripper(gripper, root)
    if (media) return media
  }

  const imageRoot = el.closest('.hypermultimedia--image__content')
  if (imageRoot instanceof HTMLElement) return imageRoot

  const wrapper = el.closest('[class*="hypermultimedia--"][class*="__content"]')
  return wrapper instanceof HTMLElement ? wrapper : null
}

export function getMediaNodeType(target: HTMLElement): string | null {
  if (target.closest('.hypermultimedia--image__content')) return 'image'
  const fromClass = target.className.match(CONTENT_CLASS)?.[1]
  if (fromClass) return fromClass
  return target.getAttribute('data-node-name')
}

/**
 * Single source of truth for media node-type classification.
 * `asset` = downloadable local media (image/audio/video); everything else is a provider embed.
 */
const ASSET_NODE_TYPES = new Set(['image', 'audio', 'video'])

export type MediaKind = 'asset' | 'embed'

export function mediaKind(nodeType: string | null): MediaKind {
  return nodeType != null && ASSET_NODE_TYPES.has(nodeType) ? 'asset' : 'embed'
}

/** Downloadable local-asset kinds (image/audio/video). */
export function isDownloadableMedia(nodeType: string | null): boolean {
  return mediaKind(nodeType) === 'asset'
}

/** Embeds with in-frame controls (play, scrub) — provider embeds plus `video`. */
export function isInteractiveEmbed(nodeType: string | null): boolean {
  if (!nodeType) return false
  return mediaKind(nodeType) === 'embed' || nodeType === 'video'
}

export function isInsideMediaControlsUI(el: HTMLElement | null): boolean {
  return !!el?.closest('.media-toolbar, .floating-popover, .hypermultimedia__resize-gripper')
}

// Cache the query: hover/out/click fire on every element boundary, so a fresh
// matchMedia() per event is pure waste.
const finePointerQuery = typeof matchMedia === 'function' ? matchMedia('(pointer: fine)') : null

export function hasFinePointer(): boolean {
  return finePointerQuery?.matches ?? false
}
