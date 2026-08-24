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

const COMMUNICATION_URLS: Record<string, SpecialUrlInfo> = {
  'mailto:': { type: 'email', title: 'Email', category: 'communication' },
  'tel:': { type: 'phone', title: 'Phone', category: 'communication' },
  'telprompt:': { type: 'phone', title: 'Phone', category: 'communication' },
  'sms:': { type: 'sms', title: 'SMS', category: 'communication' },
  'facetime:': { type: 'facetime', title: 'FaceTime', category: 'communication' },
  'facetime-audio:': {
    type: 'facetime-audio',
    title: 'FaceTime Audio',
    category: 'communication'
  }
}

const SOCIAL_URLS: Record<string, SpecialUrlInfo> = {
  'whatsapp:': { type: 'whatsapp', title: 'WhatsApp', category: 'social' },
  'tg:': { type: 'telegram', title: 'Telegram', category: 'social' },
  'discord:': { type: 'discord', title: 'Discord', category: 'social' },
  'skype:': { type: 'skype', title: 'Skype', category: 'social' },
  'slack:': { type: 'slack', title: 'Slack', category: 'social' },
  'twitter:': { type: 'twitter', title: 'Twitter', category: 'social' },
  'fb:': { type: 'facebook', title: 'Facebook', category: 'social' },
  'instagram:': { type: 'instagram', title: 'Instagram', category: 'social' },
  'linkedin:': { type: 'linkedin', title: 'LinkedIn', category: 'social' },
  'snapchat:': { type: 'snapchat', title: 'Snapchat', category: 'social' },
  'reddit:': { type: 'reddit', title: 'Reddit', category: 'social' },
  'tiktok:': { type: 'tiktok', title: 'TikTok', category: 'social' }
}

const MEETING_URLS: Record<string, SpecialUrlInfo> = {
  'zoommtg:': { type: 'zoom', title: 'Zoom Meeting', category: 'communication' },
  'zoomus:': { type: 'zoom', title: 'Zoom', category: 'communication' },
  'msteams:': { type: 'teams', title: 'Microsoft Teams', category: 'communication' },
  'webex:': { type: 'webex', title: 'Cisco Webex', category: 'communication' }
}

const APPLE_URLS: Record<string, SpecialUrlInfo> = {
  'calshow:': { type: 'calendar', title: 'Calendar', category: 'apple' },
  'x-apple-calevent:': { type: 'calendar', title: 'Calendar Event', category: 'apple' },
  'x-apple-reminder:': { type: 'reminders', title: 'Reminders', category: 'apple' },
  'contacts:': { type: 'contacts', title: 'Contacts', category: 'apple' },
  'maps:': { type: 'maps', title: 'Maps', category: 'apple' },
  'map:': { type: 'maps', title: 'Maps', category: 'apple' },
  'music:': { type: 'music', title: 'Apple Music', category: 'apple' },
  'videos:': { type: 'apple-tv', title: 'Apple TV', category: 'apple' },
  'mobilenotes:': { type: 'notes', title: 'Notes', category: 'apple' },
  'photos-redirect:': { type: 'photos', title: 'Photos', category: 'apple' },
  'shortcuts:': { type: 'shortcuts', title: 'Shortcuts', category: 'apple' },
  'itms-apps:': { type: 'app-store', title: 'App Store', category: 'apple' }
}

const PRODUCTIVITY_URLS: Record<string, SpecialUrlInfo> = {
  'github:': { type: 'github', title: 'GitHub', category: 'development' },
  'gitlab:': { type: 'gitlab', title: 'GitLab', category: 'development' },
  'vscode:': { type: 'vscode', title: 'VS Code', category: 'development' },
  'notion:': { type: 'notion', title: 'Notion', category: 'productivity' },
  'obsidian:': { type: 'obsidian', title: 'Obsidian', category: 'productivity' },
  'figma:': { type: 'figma', title: 'Figma', category: 'development' }
}

const ENTERTAINMENT_URLS: Record<string, SpecialUrlInfo> = {
  'youtube:': { type: 'youtube', title: 'YouTube', category: 'entertainment' },
  'spotify:': { type: 'spotify', title: 'Spotify', category: 'entertainment' },
  'netflix:': { type: 'netflix', title: 'Netflix', category: 'entertainment' },
  'twitch:': { type: 'twitch', title: 'Twitch', category: 'entertainment' }
}

const SHOPPING_URLS: Record<string, SpecialUrlInfo> = {
  'amazon:': { type: 'amazon', title: 'Amazon', category: 'shopping' },
  'uber:': { type: 'uber', title: 'Uber', category: 'other' },
  'lyft:': { type: 'lyft', title: 'Lyft', category: 'other' }
}

const ALL_SPECIAL_URLS = {
  ...COMMUNICATION_URLS,
  ...SOCIAL_URLS,
  ...MEETING_URLS,
  ...APPLE_URLS,
  ...PRODUCTIVITY_URLS,
  ...ENTERTAINMENT_URLS,
  ...SHOPPING_URLS
}

const DOMAIN_MAPPINGS: Record<string, SpecialUrlInfo> = {
  'wa.me': { type: 'whatsapp', title: 'WhatsApp', category: 'social' },
  't.me': { type: 'telegram', title: 'Telegram', category: 'social' },
  'discord.gg': { type: 'discord', title: 'Discord Invite', category: 'social' },
  'zoom.us': { type: 'zoom', title: 'Zoom Meeting', category: 'communication' },
  'meet.google.com': { type: 'meet', title: 'Google Meet', category: 'communication' },
  'teams.microsoft.com': {
    type: 'teams',
    title: 'Microsoft Teams',
    category: 'communication'
  },
  'github.com': { type: 'github', title: 'GitHub', category: 'development' },
  'gitlab.com': { type: 'gitlab', title: 'GitLab', category: 'development' },
  'figma.com': { type: 'figma', title: 'Figma', category: 'development' },
  'notion.so': { type: 'notion', title: 'Notion', category: 'productivity' },
  'twitter.com': { type: 'twitter', title: 'Twitter', category: 'social' },
  'x.com': { type: 'twitter', title: 'X (Twitter)', category: 'social' },
  'instagram.com': { type: 'instagram', title: 'Instagram', category: 'social' },
  'linkedin.com': { type: 'linkedin', title: 'LinkedIn', category: 'social' },
  'youtube.com': { type: 'youtube', title: 'YouTube', category: 'entertainment' },
  'spotify.com': { type: 'spotify', title: 'Spotify', category: 'entertainment' }
}

/**
 * Classify `url` against the catalog. `null` means a plain web URL (favicon).
 * Icon mapping is the consumer's job; this package stays brand-neutral.
 */
export const getSpecialUrlInfo = (url: string): SpecialUrlInfo | null => {
  const lowerUrl = url.toLowerCase()

  for (const [scheme, info] of Object.entries(ALL_SPECIAL_URLS)) {
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
    for (const [domain, info] of Object.entries(DOMAIN_MAPPINGS)) {
      if (cleanHostname === domain || cleanHostname.endsWith(`.${domain}`)) {
        return info
      }
    }
  } catch {
    /* malformed URL: no domain match possible, fall through to null */
  }

  return null
}
