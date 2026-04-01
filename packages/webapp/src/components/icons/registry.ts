import type { IconType } from 'react-icons'
import { FaDiscord } from 'react-icons/fa'
import {
  LuArchive,
  LuArrowLeft,
  LuAtSign,
  LuBaseline,
  LuBell,
  LuBellOff,
  LuBellRing,
  LuBold,
  LuBookmark,
  LuBookmarkCheck,
  LuBookmarkMinus,
  LuBookmarkPlus,
  LuCheck,
  LuCheckCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuChevronUp,
  LuClock,
  LuCloud,
  LuCloudOff,
  LuCloudUpload,
  LuCode,
  LuCopy,
  LuCrosshair,
  LuDownload,
  LuEllipsisVertical,
  LuExternalLink,
  LuEye,
  LuFileText,
  LuFilter,
  LuFilterX,
  LuFolderOpen,
  LuFoldVertical,
  LuForward,
  LuGripVertical,
  LuHighlighter,
  LuHistory,
  LuImage,
  LuInfo,
  LuItalic,
  LuLink,
  LuList,
  LuListChecks,
  LuListOrdered,
  LuListTree,
  LuLock,
  LuLogIn,
  LuMail,
  LuMegaphone,
  LuMenu,
  LuMessageSquare,
  LuMessageSquarePlus,
  LuMessageSquareText,
  LuMessagesSquare,
  LuMinus,
  LuPencil,
  LuPenOff,
  LuPin,
  LuPinOff,
  LuPlus,
  LuPrinter,
  LuRedo2,
  LuRefreshCw,
  LuRemoveFormatting,
  LuReply,
  LuSearch,
  LuSend,
  LuSettings,
  LuShare2,
  LuSmile,
  LuSmilePlus,
  LuSquareCode,
  LuSquareSplitVertical,
  LuStrikethrough,
  LuTextQuote,
  LuTrash2,
  LuTriangleAlert,
  LuType,
  LuUnderline,
  LuUndo2,
  LuUnfoldVertical,
  LuUpload,
  LuUser,
  LuUserPlus,
  LuUsers,
  LuWifi,
  LuWifiOff,
  LuX
} from 'react-icons/lu'

/**
 * Centralized Icon Registry — single source of truth for all UI icons.
 *
 * To swap an icon, change ONLY this file — every consumer updates automatically.
 *
 * Naming convention:
 *   camelCase, describes the action/concept, NOT the icon visual.
 *   ✅ `bold`, `image`, `orderedList`
 *   ❌ `bIcon`, `LuImage`, `numberList`
 *
 * Library convention:
 *   All icons use Lucide (`react-icons/lu`) for consistency.
 *   Brand icons use Font Awesome (`react-icons/fa`) where no Lucide equivalent exists.
 */
export const Icons = {
  // ── Text Formatting ──────────────────────────────────────
  bold: LuBold,
  italic: LuItalic,
  underline: LuUnderline,
  strikethrough: LuStrikethrough,
  highlight: LuHighlighter,
  clearFormatting: LuRemoveFormatting,
  textColor: LuBaseline,
  textFormat: LuType,

  // ── Lists ────────────────────────────────────────────────
  orderedList: LuListOrdered,
  bulletList: LuList,
  taskList: LuListChecks,

  // ── Insert / Rich Content ────────────────────────────────
  link: LuLink,
  image: LuImage,
  comment: LuMessageSquarePlus,
  reply: LuReply,
  thread: LuMessageSquare,
  moreVertical: LuEllipsisVertical,

  // ── Editor Actions ───────────────────────────────────────
  undo: LuUndo2,
  redo: LuRedo2,
  print: LuPrinter,
  copy: LuCopy,
  download: LuDownload,
  upload: LuUpload,
  check: LuCheck,
  settings: LuSettings,
  bookmark: LuBookmark,
  bookmarkPlus: LuBookmarkPlus,
  bookmarkMinus: LuBookmarkMinus,
  bookmarkCheck: LuBookmarkCheck,
  filter: LuFilter,
  filterX: LuFilterX,
  documents: LuFolderOpen,
  search: LuSearch,
  pencil: LuPencil,
  edit: LuPencil,
  penOff: LuPenOff,
  fileText: LuFileText,
  fileOpen: LuExternalLink,
  splitVertical: LuSquareSplitVertical,
  externalLink: LuExternalLink,

  // ── Navigation ───────────────────────────────────────────
  back: LuArrowLeft,
  menu: LuMenu,
  close: LuX,
  history: LuHistory,
  chevronRight: LuChevronRight,
  chevronDown: LuChevronDown,
  chevronUp: LuChevronUp,
  chevronLeft: LuChevronLeft,
  logIn: LuLogIn,

  // ── Communication ────────────────────────────────────────
  share: LuUsers,
  user: LuUser,
  notifications: LuBell,
  notificationsOff: LuBellOff,
  notificationsActive: LuBellRing,
  chatroom: LuMessageSquareText,

  // ── TOC ──────────────────────────────────────────────────
  crosshair: LuCrosshair,
  foldVertical: LuFoldVertical,
  unfoldVertical: LuUnfoldVertical,
  trash: LuTrash2,
  info: LuInfo,
  gripVertical: LuGripVertical,
  listTree: LuListTree,
  minus: LuMinus,
  plus: LuPlus,
  pin: LuPin,
  pinOff: LuPinOff,
  forward: LuForward,

  // ── Status ───────────────────────────────────────────────
  cloud: LuCloud,
  cloudOff: LuCloudOff,
  cloudUpload: LuCloudUpload,
  sync: LuRefreshCw,
  wifi: LuWifi,
  wifiOff: LuWifiOff,
  clock: LuClock,
  checkDouble: LuCheckCheck,
  lock: LuLock,

  // ── Code ─────────────────────────────────────────────────
  code: LuCode,
  codeBlock: LuSquareCode,
  blockquote: LuTextQuote,

  // ── Misc ─────────────────────────────────────────────────
  emoji: LuSmile,
  emojiAdd: LuSmilePlus,
  mention: LuAtSign,
  send: LuSend,
  archive: LuArchive,
  eye: LuEye,
  mail: LuMail,
  megaphone: LuMegaphone,
  messagesSquare: LuMessagesSquare,
  alert: LuTriangleAlert,
  shareNative: LuShare2,
  userPlus: LuUserPlus,

  // ── Brand ────────────────────────────────────────────────
  discord: FaDiscord
} as const satisfies Record<string, IconType>

/** Union type of all registered icon names */
export type IconName = keyof typeof Icons
