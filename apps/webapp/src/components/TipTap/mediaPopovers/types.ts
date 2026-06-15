import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import type { Editor } from '@tiptap/core'
import type { IconType } from 'react-icons'

/** Payload every typed kit insert command accepts; images also carry preloaded dims. */
export interface MediaInsertPayload {
  src: string
  width?: number
  height?: number
}

/** A field preview: which element renders it, its source, and whether to overlay a play badge. */
export interface MediaPreview {
  kind: 'img' | 'video' | 'audio'
  src: string
  /** Overlay a play badge on a static thumbnail (e.g. a YouTube poster image). */
  badge?: boolean
}

/** One row of the insert registry: how a node type is labelled, iconned, inserted, and previewed. */
export interface MediaInsertEntry {
  label: string
  Icon: IconType
  insert: (editor: Editor, payload: MediaInsertPayload) => boolean
  /** Static field preview descriptor, or null/undefined when the type has none. */
  preview?: (url: string) => MediaPreview | null
  /** True for embed types previewed via the metadata backend (no static thumbnail). */
  unfurl?: boolean
}

/** The two media-insert modes, for the shared PanelTabBar. */
export type MediaTab = 'Embed URL' | 'Upload'

/** Headless media-insert form state + actions, shared by the desktop panel and mobile sheet. */
export interface UseMediaInsert {
  tab: MediaTab
  setTab: (tab: MediaTab) => void
  url: string
  setUrl: (url: string) => void
  /** Detected node type for the current URL, or null when the field is empty. */
  detectedType: MediaNodeType | null
  /** A URL insert is in-flight (image dimension preload). */
  inserting: boolean
  /** Insert the current URL as its detected type, then run `onInserted`. */
  submitUrl: () => void
  /** Upload a local file via the shared pipeline, then run `onInserted`. */
  submitFile: (file: File) => void
}
