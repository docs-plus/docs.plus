import type { CommentAnchorV1 } from '@types'

export const CHAT_COMMENT = Symbol('chat.comment')

export type TChatCommentData = {
  anchor: CommentAnchorV1
}
