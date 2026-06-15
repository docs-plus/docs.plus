import { detectMediaType, type MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import { useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { useState } from 'react'

import { MEDIA_INSERT_REGISTRY } from './mediaInsert'
import type { MediaTab, UseMediaInsert } from './types'
import { calculateAdaptiveDimensions, uploadMediaFile } from './uploadMediaFile'

/** Preload a URL image so the node carries column-fitted dims (URL images have no intrinsic size). */
const preloadImageDimensions = (src: string): Promise<{ width: number; height: number }> =>
  new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const { width, height } = calculateAdaptiveDimensions(img.width, img.height)
      resolve({ width, height })
    }
    img.onerror = () => resolve({ width: 400, height: 300 })
    img.src = src
  })

/** Headless media-insert form (tab, URL, detection, submit) shared by the desktop panel and mobile sheet. */
export function useMediaInsert(
  editor: Editor | null,
  { onInserted }: { onInserted: () => void }
): UseMediaInsert {
  const docMetadata = useStore((state) => state.settings.metadata)
  const [tab, setTab] = useState<MediaTab>('Embed URL')
  const [url, setUrl] = useState('')
  const [inserting, setInserting] = useState(false)

  // Arbitrary non-empty URLs fall back to `image`: it covers extension-less CDN
  // URLs that `detectMediaType` can't recognize. Empty input detects nothing.
  const detectedType: MediaNodeType | null = url ? (detectMediaType(url) ?? 'image') : null

  const submitUrl = async (): Promise<void> => {
    if (!detectedType || inserting || !editor || !url.trim()) return
    setInserting(true)
    const { insert } = MEDIA_INSERT_REGISTRY[detectedType]
    const payload =
      detectedType === 'image' ? { src: url, ...(await preloadImageDimensions(url)) } : { src: url }
    const ok = insert(editor, payload)
    setInserting(false)
    if (ok) onInserted()
  }

  const submitFile = (file: File): void => {
    if (!docMetadata) return
    void uploadMediaFile(editor, file, docMetadata)
    onInserted()
  }

  return { tab, setTab, url, setUrl, detectedType, inserting, submitUrl, submitFile }
}
