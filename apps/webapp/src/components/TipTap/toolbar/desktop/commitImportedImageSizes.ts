import type { Editor } from '@tiptap/core'
import { TRANSACTION_META } from '@types'

const LOAD_MS = 8_000

const isUnsizedImage = (name: string, attrs: Record<string, unknown>): boolean => {
  if (name !== 'image') return false
  if (typeof attrs.src !== 'string' || attrs.src.length === 0) return false
  return (
    (attrs.width == null || attrs.width === '') && (attrs.height == null || attrs.height === '')
  )
}

const loadNaturalSize = (src: string): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    const image = new window.Image()
    let settled = false

    const done = (size: { width: number; height: number } | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      image.onload = null
      image.onerror = null
      resolve(size)
    }

    const timer = window.setTimeout(() => done(null), LOAD_MS)
    image.onload = () => {
      done(
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? { width: image.naturalWidth, height: image.naturalHeight }
          : null
      )
    }
    image.onerror = () => done(null)

    image.src = src
  })

/** Writes natural size after Settings replace. Misses stay unsized. */
export const commitImportedImageSizes = async (editor: Editor): Promise<void> => {
  if (editor.isDestroyed) return

  const srcs = new Set<string>()
  editor.state.doc.descendants((node) => {
    if (isUnsizedImage(node.type.name, node.attrs)) srcs.add(node.attrs.src as string)
  })
  if (srcs.size === 0) return

  // Pair by src, never by traversal index: a remote edit lands during the await, and an
  // index pair then stamps one picture's ratio onto another.
  const sizes = new Map<string, { width: number; height: number }>()
  await Promise.all(
    [...srcs].map(async (src) => {
      const size = await loadNaturalSize(src)
      if (size) sizes.set(src, size)
    })
  )
  if (editor.isDestroyed) return

  const { tr } = editor.state
  editor.state.doc.descendants((node, pos) => {
    if (!isUnsizedImage(node.type.name, node.attrs)) return
    const size = sizes.get(node.attrs.src as string)
    if (!size) return
    const keyId =
      typeof node.attrs.keyId === 'string' && node.attrs.keyId.length > 0
        ? node.attrs.keyId
        : crypto.randomUUID()
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      keyId,
      width: size.width,
      height: size.height
    })
  })

  if (tr.docChanged) {
    tr.setMeta(TRANSACTION_META.ADD_TO_HISTORY, false)
    editor.view.dispatch(tr)
  }
}
