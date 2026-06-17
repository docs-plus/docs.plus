import type { MediaNodeType } from '@docs.plus/extension-hypermultimedia'
import type { CommentPreview } from '@types'
import {
  buildCommentPreviewFromUrl as buildFromUrl,
  type CommentPreviewMediaHint
} from '@utils/commentPreview'

import type { MediaInsertEntry } from './types'

export type { CommentPreviewMediaHint, StaticMediaPreview } from '@utils/commentPreview'
export { commentPreviewFromStaticMedia } from '@utils/commentPreview'

export function mediaHintFromInsertEntry(
  entry: MediaInsertEntry | undefined
): CommentPreviewMediaHint | undefined {
  if (!entry) return undefined
  return { label: entry.label, preview: entry.preview, unfurl: entry.unfurl }
}

export function buildCommentPreviewFromUrl(
  nodeType: MediaNodeType,
  src: string,
  entry: MediaInsertEntry | undefined
): CommentPreview {
  return buildFromUrl(nodeType, src, mediaHintFromInsertEntry(entry))
}
