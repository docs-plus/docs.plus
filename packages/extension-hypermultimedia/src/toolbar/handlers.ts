import { DOMSerializer } from '@tiptap/pm/model'

import { isDownloadableMedia, mediaKind } from '../utils/media-target'
import type { MediaActionContext } from './types'
import { getKitStorage } from './types'

/** Downloadable local-asset kinds (image/audio/video); see `media-target.mediaKind`. */
export function isDownloadable(nodeType: string): boolean {
  return isDownloadableMedia(nodeType)
}

/** Provider embeds (youtube/vimeo/soundcloud/loom/x) whose `src` is an external URL. */
export function isEmbedNode(nodeType: string): boolean {
  return mediaKind(nodeType) === 'embed'
}

export function isUploadedMedia(ctx: MediaActionContext): boolean {
  return getKitStorage(ctx.editor).isUploadedMedia?.(ctx) ?? false
}

/** View Original: embeds always; uploaded image/video/audio hidden. */
export function canViewOriginal(ctx: MediaActionContext): boolean {
  if (!ctx.attrs.src) return false
  if (isEmbedNode(ctx.nodeType)) return true
  return !isUploadedMedia(ctx)
}

export function viewOriginalMedia(ctx: MediaActionContext): void {
  const src = String(ctx.attrs.src ?? '')
  if (src) window.open(src, '_blank', 'noopener,noreferrer')
  ctx.close()
}

export function removeMediaNode(ctx: MediaActionContext): void {
  const node = ctx.editor.state.doc.nodeAt(ctx.nodePos)
  if (!node || node.type.name !== ctx.nodeType) return
  ctx.editor.view.dispatch(ctx.editor.state.tr.delete(ctx.nodePos, ctx.nodePos + node.nodeSize))
  ctx.close()
}

function serializeNodeHTML(ctx: MediaActionContext): string | null {
  const node = ctx.editor.state.doc.nodeAt(ctx.nodePos)
  if (!node) return null
  const serializer = DOMSerializer.fromSchema(ctx.editor.schema)
  const wrapper = document.createElement('div')
  wrapper.append(serializer.serializeNode(node))
  return wrapper.innerHTML
}

export async function copyMediaNode(ctx: MediaActionContext): Promise<void> {
  const html = serializeNodeHTML(ctx)
  const src = String(ctx.attrs.src ?? '')
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([src], { type: 'text/plain' })
        })
      ])
    } else {
      await navigator.clipboard.writeText(src)
    }
  } catch {
    if (src) await navigator.clipboard.writeText(src).catch(() => {})
  }
  ctx.close()
}

function filenameFromSrc(src: string): string {
  try {
    const name = new URL(src, window.location.href).pathname.split('/').pop()
    return name && name.includes('.') ? name : 'media'
  } catch {
    return 'media'
  }
}

/** Same-origin / blob URLs download; cross-origin without CORS falls back to opening a tab. */
export async function downloadMedia(ctx: MediaActionContext): Promise<void> {
  const src = String(ctx.attrs.src ?? '')
  if (!src) return
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filenameFromSrc(src)
    document.body.append(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(objectUrl)
  } catch {
    window.open(src, '_blank', 'noopener,noreferrer')
  }
  ctx.close()
}

/** Reveal + focus the inline caption editor (created by the node view). */
export function focusCaption(ctx: MediaActionContext): void {
  const caption = ctx.wrapper.querySelector<HTMLElement>('.hm-caption')
  if (!caption) return
  caption.classList.remove('hm-caption--empty')
  caption.focus()
  const range = document.createRange()
  range.selectNodeContents(caption)
  range.collapse(false)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)
}
