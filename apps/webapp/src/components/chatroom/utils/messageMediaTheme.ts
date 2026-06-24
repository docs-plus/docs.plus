import type { MessageMediaKind } from '@types'

export type MessageMediaTheme = {
  accent: string
  iconBg: string
  cardBorder: string
  cardSurface: string
}

const IMAGE_THEME: MessageMediaTheme = {
  accent: 'text-emerald-600 dark:text-emerald-400',
  iconBg: 'bg-emerald-500/15',
  cardBorder: 'border-emerald-500/25',
  cardSurface: 'bg-emerald-500/5'
}

const VIDEO_THEME: MessageMediaTheme = {
  accent: 'text-violet-600 dark:text-violet-400',
  iconBg: 'bg-violet-500/15',
  cardBorder: 'border-violet-500/25',
  cardSurface: 'bg-violet-500/5'
}

const AUDIO_THEME: MessageMediaTheme = {
  accent: 'text-orange-600 dark:text-orange-400',
  iconBg: 'bg-orange-500/15',
  cardBorder: 'border-orange-500/25',
  cardSurface: 'bg-orange-500/5'
}

const FILE_THEME: MessageMediaTheme = {
  accent: 'text-base-content/70',
  iconBg: 'bg-base-content/10',
  cardBorder: 'border-base-content/15',
  cardSurface: 'bg-base-content/5'
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
