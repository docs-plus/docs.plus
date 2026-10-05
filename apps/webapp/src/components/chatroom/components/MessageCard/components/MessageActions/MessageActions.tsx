import { BookmarkButton, EmojiReactionButton, ReplyButton, ReplyInThreadButton } from './components'
import { HoverMenuActions } from './HoverMenuActions'

const MessageActions = {
  HoverMenu: HoverMenuActions,
  EmojiReaction: EmojiReactionButton,
  Reply: ReplyButton,
  Bookmark: BookmarkButton,
  ReplyInThread: ReplyInThreadButton
}

export default MessageActions
