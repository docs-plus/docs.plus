import type { Editor } from '@tiptap/core'

import { getKitStorage } from '../kitStorage'
import { isValidLoomUrl } from '../nodes/loom/helper'
import { isValidSoundCloudUrl } from '../nodes/soundcloud/helper'
import { isValidSpotifyUrl } from '../nodes/spotify/helper'
import { isValidVimeoUrl } from '../nodes/vimeo/helper'
import { normalizeXUrl } from '../nodes/x/helper'
import { isValidYoutubeUrl } from '../nodes/youtube/helper'
import { applyNodeAttributes } from '../utils/media-node-attrs'
import { closeToolbarPopover, openMediaPopover } from './menu'
import { type MediaToolbarIconScope, resolveMediaToolbarIcon } from './resolveIcon'
import type { MediaActionContext } from './types'

const validatedUrl =
  (isValid: (url: string) => boolean) =>
  (url: string): string | null =>
    isValid(url) ? url : null

/** Same-type replacement only — assets (image/video/audio) accept any non-empty src. */
const REPLACE_URL_GUARDS: Record<
  string,
  { label: string; resolve: (url: string) => string | null }
> = {
  youtube: { label: 'YouTube', resolve: validatedUrl(isValidYoutubeUrl) },
  vimeo: { label: 'Vimeo', resolve: validatedUrl(isValidVimeoUrl) },
  soundcloud: { label: 'SoundCloud', resolve: validatedUrl(isValidSoundCloudUrl) },
  spotify: { label: 'Spotify', resolve: validatedUrl(isValidSpotifyUrl) },
  loom: { label: 'Loom', resolve: validatedUrl(isValidLoomUrl) },
  x: { label: 'X post', resolve: normalizeXUrl }
}

const ANY_URL = { label: 'media', resolve: (url: string) => url }

/** Contract handed to a `replaceUrlPopover` factory. `nodePos` is a snapshot at open; `apply` re-validates, commits the normalized URL, and closes. */
export interface ReplaceUrlPopoverOptions {
  editor: Editor
  nodeType: string
  nodePos: number
  /** Current `src`, for prefilling the editor UI. */
  src: string
  /** Error message for an invalid URL, `null` when it passes the node's guard. */
  validate: (url: string) => string | null
  apply: (url: string) => void
  close: () => void
}

/** Return the popover content, or `null` to opt out so the host renders its own surface. */
export type ReplaceUrlPopoverFactory = (options: ReplaceUrlPopoverOptions) => HTMLElement | null

/** Prebuilt popover content: prefilled URL field, Replace confirm, inline error. */
export const createReplaceUrlPopover: ReplaceUrlPopoverFactory = (options) => {
  const body = document.createElement('div')
  body.className = 'media-toolbar__submenu'

  const input = document.createElement('input')
  input.type = 'url'
  input.className = 'media-toolbar__input'
  input.value = options.src
  input.setAttribute('aria-label', 'Media URL')

  const error = document.createElement('p')
  error.className = 'media-toolbar__error'
  error.hidden = true

  const submit = () => {
    const value = input.value.trim()
    if (!value || value === options.src) {
      options.close()
      return
    }
    const message = options.validate(value)
    if (message) {
      error.textContent = message
      error.hidden = false
      input.setAttribute('aria-invalid', 'true')
      return
    }
    options.apply(value)
  }

  input.onkeydown = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submit()
  }

  const confirm = document.createElement('button')
  confirm.type = 'button'
  confirm.className = 'media-toolbar__submenu-item'
  const iconScope: MediaToolbarIconScope = {
    editor: options.editor,
    nodeType: options.nodeType
  }
  const icon = resolveMediaToolbarIcon(iconScope, 'replace') ?? ''
  confirm.innerHTML = `${icon}<span>Replace</span>`
  confirm.onclick = submit

  body.append(input, confirm, error)
  return body
}

/** Open the URL editor in a dialog popover anchored to the media node (bottom, flipping to top). A `replaceUrlPopover` factory returning `null` opts out entirely. */
export function openReplaceUrlPopover(ctx: MediaActionContext): void {
  const factory = getKitStorage(ctx.editor).replaceUrlPopover ?? createReplaceUrlPopover
  const guard = REPLACE_URL_GUARDS[ctx.nodeType] ?? ANY_URL
  const resolve = (url: string): string | null => {
    const value = url.trim()
    return value ? guard.resolve(value) : null
  }
  const close = () => closeToolbarPopover()

  const content = factory({
    editor: ctx.editor,
    nodeType: ctx.nodeType,
    nodePos: ctx.nodePos,
    src: String(ctx.attrs.src ?? ''),
    validate: (url) => (resolve(url) === null ? `Enter a valid ${guard.label} URL` : null),
    apply: (url) => {
      const src = resolve(url)
      if (src === null) return
      applyNodeAttributes(ctx.editor, ctx.nodePos, { src })
      close()
    },
    close
  })
  // Null = host surface; still dismiss the overflow menu the action was invoked from.
  if (!content) {
    close()
    return
  }

  openMediaPopover({
    kind: 'media-replace',
    content,
    trigger: ctx.wrapper,
    variant: 'dialog',
    role: 'dialog',
    ariaLabel: 'Replace URL',
    toggle: false
  })
  content.querySelector('input')?.focus()
}
