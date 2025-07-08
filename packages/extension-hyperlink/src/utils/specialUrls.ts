/**
 * Special URL schemes and their corresponding SVG icons
 * Based on: https://github.com/bhagyas/app-urls
 */

export type SpecialUrlInfo = {
  type: string
  title: string
  icon: string // Function name from iconList.ts (e.g., 'HiMail', 'FaWhatsapp')
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

// Communication & Phone
const COMMUNICATION_URLS: Record<string, SpecialUrlInfo> = {
  'mailto:': { type: 'email', title: 'Email', icon: 'HiMail', category: 'communication' },
  'tel:': { type: 'phone', title: 'Phone', icon: 'HiPhone', category: 'communication' },
  'telprompt:': { type: 'phone', title: 'Phone', icon: 'HiPhone', category: 'communication' },
  'sms:': { type: 'sms', title: 'SMS', icon: 'HiChatBubbleLeftRight', category: 'communication' },
  'facetime:': {
    type: 'facetime',
    title: 'FaceTime',
    icon: 'HiVideoCamera',
    category: 'communication'
  },
  'facetime-audio:': {
    type: 'facetime-audio',
    title: 'FaceTime Audio',
    icon: 'HiPhone',
    category: 'communication'
  }
}

// Social Media & Messaging
const SOCIAL_URLS: Record<string, SpecialUrlInfo> = {
  'whatsapp:': { type: 'whatsapp', title: 'WhatsApp', icon: 'FaWhatsapp', category: 'social' },
  'tg:': { type: 'telegram', title: 'Telegram', icon: 'FaTelegram', category: 'social' },
  'discord:': { type: 'discord', title: 'Discord', icon: 'FaDiscord', category: 'social' },
  'skype:': { type: 'skype', title: 'Skype', icon: 'FaSkype', category: 'social' },
  'slack:': { type: 'slack', title: 'Slack', icon: 'FaSlack', category: 'social' },
  'twitter:': { type: 'twitter', title: 'Twitter', icon: 'FaTwitter', category: 'social' },
  'fb:': { type: 'facebook', title: 'Facebook', icon: 'FaFacebook', category: 'social' },
  'instagram:': { type: 'instagram', title: 'Instagram', icon: 'FaInstagram', category: 'social' },
  'linkedin:': { type: 'linkedin', title: 'LinkedIn', icon: 'FaLinkedin', category: 'social' },
  'snapchat:': { type: 'snapchat', title: 'Snapchat', icon: 'FaSnapchat', category: 'social' },
  'reddit:': { type: 'reddit', title: 'Reddit', icon: 'FaReddit', category: 'social' },
  'tiktok:': { type: 'tiktok', title: 'TikTok', icon: 'SiTiktok', category: 'social' }
}

// Video Conferencing & Meeting
const MEETING_URLS: Record<string, SpecialUrlInfo> = {
  'zoommtg:': { type: 'zoom', title: 'Zoom Meeting', icon: 'SiZoom', category: 'communication' },
  'zoomus:': { type: 'zoom', title: 'Zoom', icon: 'SiZoom', category: 'communication' },
  'msteams:': {
    type: 'teams',
    title: 'Microsoft Teams',
    icon: 'SiMicrosoftteams',
    category: 'communication'
  },
  'webex:': { type: 'webex', title: 'Cisco Webex', icon: 'SiCisco', category: 'communication' }
}

// Apple Apps
const APPLE_URLS: Record<string, SpecialUrlInfo> = {
  'calshow:': { type: 'calendar', title: 'Calendar', icon: 'HiCalendar', category: 'apple' },
  'x-apple-calevent:': {
    type: 'calendar',
    title: 'Calendar Event',
    icon: 'HiCalendar',
    category: 'apple'
  },
  'contacts:': { type: 'contacts', title: 'Contacts', icon: 'HiUsers', category: 'apple' },
  'maps:': { type: 'maps', title: 'Maps', icon: 'HiMapPin', category: 'apple' },
  'map:': { type: 'maps', title: 'Maps', icon: 'HiMapPin', category: 'apple' },
  'music:': { type: 'music', title: 'Apple Music', icon: 'HiMusicalNote', category: 'apple' },
  'videos:': { type: 'tv', title: 'Apple TV', icon: 'HiTv', category: 'apple' },
  'mobilenotes:': { type: 'notes', title: 'Notes', icon: 'HiDocumentText', category: 'apple' },
  'x-apple-reminder:': {
    type: 'reminders',
    title: 'Reminders',
    icon: 'HiCheckCircle',
    category: 'apple'
  },
  'photos-redirect:': { type: 'photos', title: 'Photos', icon: 'HiPhoto', category: 'apple' },
  'shortcuts:': {
    type: 'shortcuts',
    title: 'Shortcuts',
    icon: 'HiLightningBolt',
    category: 'apple'
  },
  'itms-apps:': { type: 'appstore', title: 'App Store', icon: 'SiAppstore', category: 'apple' }
}

// Development & Productivity
const PRODUCTIVITY_URLS: Record<string, SpecialUrlInfo> = {
  'github:': { type: 'github', title: 'GitHub', icon: 'FaGithub', category: 'development' },
  'gitlab:': { type: 'gitlab', title: 'GitLab', icon: 'FaGitlab', category: 'development' },
  'vscode:': {
    type: 'vscode',
    title: 'VS Code',
    icon: 'SiVisualstudiocode',
    category: 'development'
  },
  'notion:': { type: 'notion', title: 'Notion', icon: 'SiNotion', category: 'productivity' },
  'obsidian:': {
    type: 'obsidian',
    title: 'Obsidian',
    icon: 'SiObsidian',
    category: 'productivity'
  },
  'figma:': { type: 'figma', title: 'Figma', icon: 'FaFigma', category: 'development' }
}

// Entertainment & Media
const ENTERTAINMENT_URLS: Record<string, SpecialUrlInfo> = {
  'youtube:': { type: 'youtube', title: 'YouTube', icon: 'FaYoutube', category: 'entertainment' },
  'spotify:': { type: 'spotify', title: 'Spotify', icon: 'FaSpotify', category: 'entertainment' },
  'netflix:': { type: 'netflix', title: 'Netflix', icon: 'SiNetflix', category: 'entertainment' },
  'twitch:': { type: 'twitch', title: 'Twitch', icon: 'FaTwitch', category: 'entertainment' }
}

// Shopping & Commerce
const SHOPPING_URLS: Record<string, SpecialUrlInfo> = {
  'amazon:': { type: 'amazon', title: 'Amazon', icon: 'FaAmazon', category: 'shopping' },
  'uber:': { type: 'uber', title: 'Uber', icon: 'SiUber', category: 'other' },
  'lyft:': { type: 'lyft', title: 'Lyft', icon: 'SiLyft', category: 'other' }
}

// Combine all URL mappings
const ALL_SPECIAL_URLS = {
  ...COMMUNICATION_URLS,
  ...SOCIAL_URLS,
  ...MEETING_URLS,
  ...APPLE_URLS,
  ...PRODUCTIVITY_URLS,
  ...ENTERTAINMENT_URLS,
  ...SHOPPING_URLS
}

// Domain-based detection for web URLs
const DOMAIN_MAPPINGS: Record<string, SpecialUrlInfo> = {
  'wa.me': { type: 'whatsapp', title: 'WhatsApp', icon: 'FaWhatsapp', category: 'social' },
  't.me': { type: 'telegram', title: 'Telegram', icon: 'FaTelegram', category: 'social' },
  'discord.gg': { type: 'discord', title: 'Discord Invite', icon: 'FaDiscord', category: 'social' },
  'zoom.us': { type: 'zoom', title: 'Zoom Meeting', icon: 'SiZoom', category: 'communication' },
  'meet.google.com': {
    type: 'meet',
    title: 'Google Meet',
    icon: 'SiGooglemeet',
    category: 'communication'
  },
  'teams.microsoft.com': {
    type: 'teams',
    title: 'Microsoft Teams',
    icon: 'SiMicrosoftteams',
    category: 'communication'
  },
  'github.com': { type: 'github', title: 'GitHub', icon: 'FaGithub', category: 'development' },
  'gitlab.com': { type: 'gitlab', title: 'GitLab', icon: 'FaGitlab', category: 'development' },
  'figma.com': { type: 'figma', title: 'Figma', icon: 'FaFigma', category: 'development' },
  'notion.so': { type: 'notion', title: 'Notion', icon: 'SiNotion', category: 'productivity' },
  'twitter.com': { type: 'twitter', title: 'Twitter', icon: 'FaTwitter', category: 'social' },
  'x.com': { type: 'twitter', title: 'X (Twitter)', icon: 'FaTwitter', category: 'social' },
  'instagram.com': {
    type: 'instagram',
    title: 'Instagram',
    icon: 'FaInstagram',
    category: 'social'
  },
  'linkedin.com': { type: 'linkedin', title: 'LinkedIn', icon: 'FaLinkedin', category: 'social' },
  'youtube.com': {
    type: 'youtube',
    title: 'YouTube',
    icon: 'FaYoutube',
    category: 'entertainment'
  },
  'spotify.com': { type: 'spotify', title: 'Spotify', icon: 'FaSpotify', category: 'entertainment' }
}

/**
 * Detect special URL and return corresponding info
 */
export const getSpecialUrlInfo = (url: string): SpecialUrlInfo | null => {
  const lowerUrl = url.toLowerCase()

  // Check URL schemes first (protocol-based)
  for (const [scheme, info] of Object.entries(ALL_SPECIAL_URLS)) {
    if (lowerUrl.startsWith(scheme)) {
      return info
    }
  }

  // Check domain-based mappings for web URLs
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    // Remove www. prefix
    const cleanHostname = hostname.startsWith('www.') ? hostname.slice(4) : hostname

    // Direct domain match
    if (DOMAIN_MAPPINGS[cleanHostname]) {
      return DOMAIN_MAPPINGS[cleanHostname]
    }

    // Check for subdomain matches (e.g., api.github.com matches github.com)
    for (const [domain, info] of Object.entries(DOMAIN_MAPPINGS)) {
      if (cleanHostname.endsWith(`.${domain}`) || cleanHostname === domain) {
        return info
      }
    }
  } catch {
    // Not a valid URL, continue with scheme checking
  }

  return null
}

/**
 * Get all available categories
 */
export const getCategories = (): string[] => {
  const categories = new Set<string>()
  Object.values(ALL_SPECIAL_URLS).forEach((info) => categories.add(info.category))
  Object.values(DOMAIN_MAPPINGS).forEach((info) => categories.add(info.category))
  return Array.from(categories).sort()
}

/**
 * Get URLs by category
 */
export const getUrlsByCategory = (category: string): Record<string, SpecialUrlInfo> => {
  const result: Record<string, SpecialUrlInfo> = {}

  // Add scheme-based URLs
  Object.entries(ALL_SPECIAL_URLS).forEach(([scheme, info]) => {
    if (info.category === category) {
      result[scheme] = info
    }
  })

  // Add domain-based URLs
  Object.entries(DOMAIN_MAPPINGS).forEach(([domain, info]) => {
    if (info.category === category) {
      result[domain] = info
    }
  })

  return result
}

export default {
  getSpecialUrlInfo,
  getCategories,
  getUrlsByCategory,
  ALL_SPECIAL_URLS,
  DOMAIN_MAPPINGS
}
