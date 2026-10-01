import {
  BookmarkButton,
  CopyLinkAction,
  CopyToDocAction,
  DeleteAction,
  DownloadAction,
  EditAction,
  EmojiReactionButton,
  GroupAuth,
  ReadStatusDisplay,
  ReplyButton,
  ReplyInThreadButton
} from './components'
import { HoverMenuActions } from './HoverMenuActions'

const MessageActions = {
  HoverMenu: HoverMenuActions,
  EmojiReaction: EmojiReactionButton,
  Reply: ReplyButton,
  Bookmark: BookmarkButton,
  ReplyInThread: ReplyInThreadButton,
  CopyLink: CopyLinkAction,
  CopyToDoc: CopyToDocAction,
  Download: DownloadAction,
  Delete: DeleteAction,
  Edit: EditAction,
  ReadStatus: ReadStatusDisplay,
  GroupAuth
}

export default MessageActions
