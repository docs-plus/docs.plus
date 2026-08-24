import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import type { Editor } from '@tiptap/core'
import type { IconType } from 'react-icons'

export interface MediaInsertPayload {
  src: string
  width?: number
  height?: number
}

export interface MediaPreview {
  kind: 'img' | 'video' | 'audio'
  src: string
  badge?: boolean
}

export interface MediaInsertEntry {
  label: string
  Icon: IconType
  insert: (editor: Editor, payload: MediaInsertPayload) => boolean
  preview?: (url: string) => MediaPreview | null
  /** Embed types previewed via the metadata backend (no static thumbnail). */
  unfurl?: boolean
}

export type MediaTab = 'Embed URL' | 'Upload'

export interface UseMediaInsert {
  tab: MediaTab
  setTab: (tab: MediaTab) => void
  url: string
  setUrl: (url: string) => void
  detectedType: MediaNodeType | null
  inserting: boolean
  submitUrl: () => void
  submitFile: (file: File) => void
}
