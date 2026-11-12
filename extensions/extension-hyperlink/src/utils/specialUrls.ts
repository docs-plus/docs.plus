/** Catalog of app schemes and well-known domains. Source: https://github.com/bhagyas/app-urls */

/**
 * Type-only union for consumer icon maps (`Partial<Record<SpecialUrlType, …>>`).
 * Zero runtime bytes. Naming convention is in this package's AGENTS.md.
 */
export type SpecialUrlType =
  | 'email'
  | 'phone'
  | 'sms'
  | 'facetime'
  | 'facetime-audio'
  | 'whatsapp'
  | 'telegram'
  | 'discord'
  | 'skype'
  | 'slack'
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'snapchat'
  | 'reddit'
  | 'tiktok'
  | 'zoom'
  | 'teams'
  | 'webex'
  | 'meet'
  | 'calendar'
  | 'reminders'
  | 'contacts'
  | 'maps'
  | 'music'
  | 'apple-tv'
  | 'notes'
  | 'photos'
  | 'shortcuts'
  | 'app-store'
  | 'github'
  | 'gitlab'
  | 'vscode'
  | 'notion'
  | 'obsidian'
  | 'figma'
  | 'youtube'
  | 'spotify'
  | 'netflix'
  | 'twitch'
  | 'amazon'
  | 'uber'
  | 'lyft'

export type SpecialUrlInfo = {
  type: SpecialUrlType
  title: string
  category:
    | 'communication'
    | 'social'
    | 'productivity'
    | 'entertainment'
    | 'shopping'
    | 'development'
    | 'apple'
    | 'other'
}

type Row = readonly [string, SpecialUrlType, string, SpecialUrlInfo['category']]
const toEntries = (rows: readonly Row[]): Array<[string, SpecialUrlInfo]> =>
  rows.map(([key, type, title, category]) => [key, { type, title, category }])

const ALL_SPECIAL_URLS_ENTRIES = /* @__PURE__ */ toEntries([
  ['mailto:', 'email', 'Email', 'communication'],
  ['tel:', 'phone', 'Phone', 'communication'],
  ['telprompt:', 'phone', 'Phone', 'communication'],
  ['sms:', 'sms', 'SMS', 'communication'],
  ['facetime:', 'facetime', 'FaceTime', 'communication'],
  ['facetime-audio:', 'facetime-audio', 'FaceTime Audio', 'communication'],
  ['whatsapp:', 'whatsapp', 'WhatsApp', 'social'],
  ['tg:', 'telegram', 'Telegram', 'social'],
  ['discord:', 'discord', 'Discord', 'social'],
  ['skype:', 'skype', 'Skype', 'social'],
  ['slack:', 'slack', 'Slack', 'social'],
  ['twitter:', 'twitter', 'Twitter', 'social'],
  ['fb:', 'facebook', 'Facebook', 'social'],
  ['instagram:', 'instagram', 'Instagram', 'social'],
  ['linkedin:', 'linkedin', 'LinkedIn', 'social'],
  ['snapchat:', 'snapchat', 'Snapchat', 'social'],
  ['reddit:', 'reddit', 'Reddit', 'social'],
  ['tiktok:', 'tiktok', 'TikTok', 'social'],
  ['zoommtg:', 'zoom', 'Zoom Meeting', 'communication'],
  ['zoomus:', 'zoom', 'Zoom', 'communication'],
  ['msteams:', 'teams', 'Microsoft Teams', 'communication'],
  ['webex:', 'webex', 'Cisco Webex', 'communication'],
  ['calshow:', 'calendar', 'Calendar', 'apple'],
  ['x-apple-calevent:', 'calendar', 'Calendar Event', 'apple'],
  ['x-apple-reminder:', 'reminders', 'Reminders', 'apple'],
  ['contacts:', 'contacts', 'Contacts', 'apple'],
  ['maps:', 'maps', 'Maps', 'apple'],
  ['map:', 'maps', 'Maps', 'apple'],
  ['music:', 'music', 'Apple Music', 'apple'],
  ['videos:', 'apple-tv', 'Apple TV', 'apple'],
  ['mobilenotes:', 'notes', 'Notes', 'apple'],
  ['photos-redirect:', 'photos', 'Photos', 'apple'],
  ['shortcuts:', 'shortcuts', 'Shortcuts', 'apple'],
  ['itms-apps:', 'app-store', 'App Store', 'apple'],
  ['github:', 'github', 'GitHub', 'development'],
  ['gitlab:', 'gitlab', 'GitLab', 'development'],
  ['vscode:', 'vscode', 'VS Code', 'development'],
  ['notion:', 'notion', 'Notion', 'productivity'],
  ['obsidian:', 'obsidian', 'Obsidian', 'productivity'],
  ['figma:', 'figma', 'Figma', 'development'],
  ['youtube:', 'youtube', 'YouTube', 'entertainment'],
  ['spotify:', 'spotify', 'Spotify', 'entertainment'],
  ['netflix:', 'netflix', 'Netflix', 'entertainment'],
  ['twitch:', 'twitch', 'Twitch', 'entertainment'],
  ['amazon:', 'amazon', 'Amazon', 'shopping'],
  ['uber:', 'uber', 'Uber', 'other'],
  ['lyft:', 'lyft', 'Lyft', 'other']
] as const satisfies readonly Row[])

const DOMAIN_MAPPINGS_ENTRIES = /* @__PURE__ */ toEntries([
  ['wa.me', 'whatsapp', 'WhatsApp', 'social'],
  ['t.me', 'telegram', 'Telegram', 'social'],
  ['discord.gg', 'discord', 'Discord Invite', 'social'],
  ['zoom.us', 'zoom', 'Zoom Meeting', 'communication'],
  ['meet.google.com', 'meet', 'Google Meet', 'communication'],
  ['teams.microsoft.com', 'teams', 'Microsoft Teams', 'communication'],
  ['github.com', 'github', 'GitHub', 'development'],
  ['gitlab.com', 'gitlab', 'GitLab', 'development'],
  ['figma.com', 'figma', 'Figma', 'development'],
  ['notion.so', 'notion', 'Notion', 'productivity'],
  ['twitter.com', 'twitter', 'Twitter', 'social'],
  ['x.com', 'twitter', 'X (Twitter)', 'social'],
  ['instagram.com', 'instagram', 'Instagram', 'social'],
  ['linkedin.com', 'linkedin', 'LinkedIn', 'social'],
  ['youtube.com', 'youtube', 'YouTube', 'entertainment'],
  ['spotify.com', 'spotify', 'Spotify', 'entertainment']
] as const satisfies readonly Row[])

/**
 * Classify `url` against the catalog. `null` means a plain web URL (favicon).
 * Icon mapping is the consumer's job; this package stays brand-neutral.
 */
export const getSpecialUrlInfo = (url: string): SpecialUrlInfo | null => {
  const lowerUrl = url.toLowerCase()

  for (const [scheme, info] of ALL_SPECIAL_URLS_ENTRIES) {
    if (lowerUrl.startsWith(scheme)) {
      return info
    }
  }

  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()
    const cleanHostname = hostname.startsWith('www.') ? hostname.slice(4) : hostname

    // Loop covers both exact matches (`cleanHostname === domain`) and
    // subdomain suffixes (`api.github.com` → `github.com`); a separate
    // direct-lookup fast path was redundant and dropped.
    for (const [domain, info] of DOMAIN_MAPPINGS_ENTRIES) {
      if (cleanHostname === domain || cleanHostname.endsWith(`.${domain}`)) {
        return info
      }
    }
  } catch {
    /* malformed URL: no domain match possible, fall through to null */
  }

  return null
}
