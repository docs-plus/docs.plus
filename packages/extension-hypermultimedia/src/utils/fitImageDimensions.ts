import type { Editor } from '@tiptap/core'

export interface FitBounds {
  maxWidth: number
  maxHeight?: number
}

export function fitDimensionsToBounds(
  width: number,
  height: number,
  bounds: FitBounds
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || bounds.maxWidth <= 0) {
    return { width, height }
  }

  const aspectRatio = width / height
  let targetWidth = width
  let targetHeight = height
  const maxHeight = bounds.maxHeight ?? Number.POSITIVE_INFINITY

  if (targetWidth > bounds.maxWidth) {
    targetWidth = bounds.maxWidth
    targetHeight = Math.round(targetWidth / aspectRatio)
  }

  if (targetHeight > maxHeight) {
    targetHeight = maxHeight
    targetWidth = Math.round(targetHeight * aspectRatio)
  }

  return { width: Math.round(targetWidth), height: Math.round(targetHeight) }
}

/** ProseMirror content width — caps insert + resize to the editable column. */
export function getEditorContentWidth(editor: Editor): number {
  const root = editor.view.dom
  const prose =
    root instanceof HTMLElement && root.classList.contains('ProseMirror')
      ? root
      : (root.querySelector('.ProseMirror') as HTMLElement | null)
  const target = prose ?? (root instanceof HTMLElement ? root : null)
  if (target?.clientWidth) return target.clientWidth

  return root.parentElement?.clientWidth ?? 0
}

/** Scale layout down when width exceeds the editable column (insert + resize). */
export function fitLayoutToEditorColumn(
  editor: Editor,
  width: number,
  height: number
): { width: number; height: number } {
  const maxWidth = getEditorContentWidth(editor)
  if (maxWidth <= 0 || width <= 0 || height <= 0) {
    return { width, height }
  }
  return fitDimensionsToBounds(width, height, { maxWidth })
}
