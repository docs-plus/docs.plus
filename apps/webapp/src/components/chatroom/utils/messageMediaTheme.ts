import type { MessageMediaKind } from '@types'

export type MessageMediaTheme = {
  accent: string
  iconBg: string
  cardBorder: string
  cardSurface: string
}

// Neutral card, colored icon: the media category lives in the icon accent only
// (theme-tracked --media-* tokens), never in the card surface — Slack/Telegram model.
const NEUTRAL_CARD = {
  cardBorder: 'border-base-300',
  cardSurface: 'bg-base-200/60'
}

const IMAGE_THEME: MessageMediaTheme = {
  accent: 'text-media-image',
  iconBg: 'bg-media-image/15',
  ...NEUTRAL_CARD
}

const VIDEO_THEME: MessageMediaTheme = {
  accent: 'text-media-video',
  iconBg: 'bg-media-video/15',
  ...NEUTRAL_CARD
}

const AUDIO_THEME: MessageMediaTheme = {
  accent: 'text-media-audio',
  iconBg: 'bg-media-audio/15',
  ...NEUTRAL_CARD
}

const FILE_THEME: MessageMediaTheme = {
  accent: 'text-base-content/70',
  iconBg: 'bg-base-content/10',
  ...NEUTRAL_CARD
}

const MEDIA_THEMES: Record<MessageMediaKind, MessageMediaTheme> = {
  image: IMAGE_THEME,
  video: VIDEO_THEME,
  audio: AUDIO_THEME,
  file: FILE_THEME
}

export function messageMediaTheme(kind: MessageMediaKind): MessageMediaTheme {
  return MEDIA_THEMES[kind]
}
