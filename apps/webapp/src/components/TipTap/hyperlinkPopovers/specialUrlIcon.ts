import { Icons } from '@components/icons/registry'
import { getSpecialUrlInfo, type SpecialUrlType } from '@docs.plus/extension-hyperlink'
import type { IconType } from 'react-icons'

/**
 * Preview popover and phone sheet; pad link icons come from `padLinkIcon`. Its own module, because
 * the phone sheet loads on every route: importing it from `previewShared` put `react-dom/server` in
 * `_app` and broke every server-rendered page on production (2026-11-09). `Partial` is deliberate:
 * for https URLs the route icon wins.
 */
const TYPE_TO_ICON: Partial<Record<SpecialUrlType, IconType>> = {
  email: Icons.mail,
  phone: Icons.phone,
  'facetime-audio': Icons.phone,
  sms: Icons.chatroom,
  facetime: Icons.video,
  whatsapp: Icons.chatroom,
  telegram: Icons.chatroom,
  discord: Icons.chatroom,
  skype: Icons.chatroom,
  slack: Icons.chatroom,
  twitter: Icons.share,
  facebook: Icons.share,
  instagram: Icons.share,
  linkedin: Icons.share,
  snapchat: Icons.share,
  reddit: Icons.share,
  tiktok: Icons.share,
  contacts: Icons.share,
  zoom: Icons.video,
  teams: Icons.video,
  webex: Icons.video,
  calendar: Icons.calendar,
  reminders: Icons.calendar,
  maps: Icons.mapPin,
  uber: Icons.mapPin,
  lyft: Icons.mapPin,
  music: Icons.music,
  spotify: Icons.music,
  'apple-tv': Icons.tv,
  youtube: Icons.tv,
  netflix: Icons.tv,
  twitch: Icons.tv,
  notes: Icons.fileText,
  shortcuts: Icons.fileText,
  github: Icons.fileText,
  gitlab: Icons.fileText,
  vscode: Icons.fileText,
  notion: Icons.fileText,
  obsidian: Icons.fileText,
  figma: Icons.fileText,
  photos: Icons.image,
  'app-store': Icons.externalLink,
  amazon: Icons.externalLink
}

/** The glyph for a link with no http(s) origin (mailto:, tel:, app schemes), if it has one. */
export const specialUrlIcon = (href: string): IconType | undefined => {
  const specialInfo = getSpecialUrlInfo(href)
  return specialInfo ? TYPE_TO_ICON[specialInfo.type] : undefined
}
