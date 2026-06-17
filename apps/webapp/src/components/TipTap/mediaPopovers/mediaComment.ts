import {
  closeMediaToolbar,
  composeMediaActions,
  type MediaAction,
  type MediaActionContext,
  type MediaActionsResolver,
  type MediaNodeType
} from '@docs.plus/extension-hypermultimedia'
import {
  buildMediaCommentAnchor,
  publishDocumentComment,
  resolveHeadingIdForDocPos
} from '@services/commentAnchor'
import type { Editor } from '@tiptap/core'

import { mediaHintFromInsertEntry } from './buildCommentPreview'
import { MEDIA_INSERT_REGISTRY } from './mediaInsert'

export function publishMediaComment(
  editor: Editor,
  nodePos: number,
  nodeType: string,
  attrs: Record<string, unknown>
): boolean {
  if (!editor.isEditable) return false

  const headingId = resolveHeadingIdForDocPos(editor.state.doc, nodePos)
  if (!headingId) {
    console.warn('[mediaComment]: no heading section for media node')
    return false
  }

  publishDocumentComment(
    buildMediaCommentAnchor(
      headingId,
      nodeType,
      attrs,
      mediaHintFromInsertEntry(MEDIA_INSERT_REGISTRY[nodeType as MediaNodeType])
    )
  )
  return true
}

export function publishMediaCommentFromContext(ctx: MediaActionContext): void {
  ctx.close()
  closeMediaToolbar(ctx.wrapper)
  publishMediaComment(ctx.editor, ctx.nodePos, ctx.nodeType, ctx.attrs)
}

export const MEDIA_COMMENT_ACTION: MediaAction = {
  id: 'comment',
  label: () => 'Comment',
  placement: 'inline',
  isVisible: (ctx) => ctx.editor.isEditable,
  run: publishMediaCommentFromContext
}

export function getMediaActionsResolver(): MediaActionsResolver {
  return (defaults) => {
    if (defaults.some((action) => action.id === MEDIA_COMMENT_ACTION.id)) {
      return defaults
    }
    return composeMediaActions(defaults).add(MEDIA_COMMENT_ACTION, { after: 'download' }).result()
  }
}
