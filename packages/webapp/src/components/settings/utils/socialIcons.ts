import type { ComponentType, CSSProperties } from 'react'

type IconPack = 'fa' | 'fa6' | 'si'

interface IconEntry {
  pack: IconPack
  key: string
  color: string
}

export type IconComponent = ComponentType<{
  size?: number
  className?: string
  style?: CSSProperties
}>

type IconModule = Record<string, IconComponent>

const facebook: IconEntry = { pack: 'fa', key: 'FaFacebook', color: '#1877f2' }
const instagram: IconEntry = { pack: 'fa', key: 'FaInstagram', color: '#e4405f' }
const xTwitter: IconEntry = { pack: 'fa6', key: 'FaXTwitter', color: '#000000' }
const linkedin: IconEntry = { pack: 'fa', key: 'FaLinkedin', color: '#0077b5' }
const reddit: IconEntry = { pack: 'fa', key: 'FaReddit', color: '#ff4500' }
const pinterest: IconEntry = { pack: 'fa', key: 'FaPinterest', color: '#bd081c' }
const mastodonSi: IconEntry = { pack: 'si', key: 'SiMastodon', color: '#6364ff' }
const mastodonFa: IconEntry = { pack: 'fa', key: 'FaMastodon', color: '#6364ff' }
const whatsapp: IconEntry = { pack: 'fa', key: 'FaWhatsapp', color: '#25d366' }
const telegram: IconEntry = { pack: 'fa', key: 'FaTelegram', color: '#26a5e4' }
const discord: IconEntry = { pack: 'fa', key: 'FaDiscord', color: '#5865f2' }
const snapchat: IconEntry = { pack: 'fa', key: 'FaSnapchat', color: '#fffc00' }
const skype: IconEntry = { pack: 'fa', key: 'FaSkype', color: '#00aff0' }
const weixin: IconEntry = { pack: 'fa', key: 'FaWeixin', color: '#07c160' }
const youtube: IconEntry = { pack: 'fa', key: 'FaYoutube', color: '#ff0000' }
const tiktok: IconEntry = { pack: 'fa', key: 'FaTiktok', color: '#010101' }
const spotify: IconEntry = { pack: 'fa', key: 'FaSpotify', color: '#1db954' }
const apple: IconEntry = { pack: 'fa', key: 'FaApple', color: '#fc3c44' }
const lastfm: IconEntry = { pack: 'fa', key: 'FaLastfm', color: '#d51007' }
const github: IconEntry = { pack: 'fa', key: 'FaGithub', color: '#181717' }
const hashnode: IconEntry = { pack: 'si', key: 'SiHashnode', color: '#2962ff' }
const notion: IconEntry = { pack: 'si', key: 'SiNotion', color: '#000000' }
const behance: IconEntry = { pack: 'fa', key: 'FaBehance', color: '#1769ff' }
const flickr: IconEntry = { pack: 'fa', key: 'FaFlickr', color: '#0063dc' }
const paypal: IconEntry = { pack: 'fa', key: 'FaPaypal', color: '#003087' }
const amazon: IconEntry = { pack: 'fa', key: 'FaAmazon', color: '#ff9900' }

/**
 * Domain → icon entry. Aliases (e.g. `fb.com` vs `facebook.com`) share the
 * same entry so the dynamic import resolves to the same module + key.
 */
export const SOCIAL_ICONS: Record<string, IconEntry> = {
  // Social networks
  'facebook.com': facebook,
  'fb.com': facebook,
  'instagram.com': instagram,
  'instagr.am': instagram,
  'twitter.com': xTwitter,
  'x.com': xTwitter,
  'threads.net': { pack: 'si', key: 'SiThreads', color: '#000000' },
  'bsky.app': { pack: 'si', key: 'SiBluesky', color: '#0085ff' },
  'linkedin.com': linkedin,
  'lnkd.in': linkedin,
  'reddit.com': reddit,
  'redd.it': reddit,
  'tumblr.com': { pack: 'fa', key: 'FaTumblr', color: '#35465c' },
  'pinterest.com': pinterest,
  'pin.it': pinterest,
  'quora.com': { pack: 'fa', key: 'FaQuora', color: '#b92b27' },
  'mastodon.social': mastodonSi,
  'mastodon.online': mastodonFa,
  'vk.com': { pack: 'fa', key: 'FaVk', color: '#4c75a3' },
  'clubhouse.com': { pack: 'si', key: 'SiClubhouse', color: '#f2e6d9' },

  // Messaging
  'whatsapp.com': whatsapp,
  'wa.me': whatsapp,
  'telegram.org': telegram,
  't.me': telegram,
  'discord.com': discord,
  'discord.gg': discord,
  'signal.org': { pack: 'si', key: 'SiSignal', color: '#3a76f0' },
  'snapchat.com': snapchat,
  'snap.com': snapchat,
  'slack.com': { pack: 'fa', key: 'FaSlack', color: '#4a154b' },
  'skype.com': skype,
  'join.skype.com': skype,
  'zoom.us': { pack: 'si', key: 'SiZoom', color: '#0b5cff' },
  'line.me': { pack: 'si', key: 'SiLine', color: '#00c300' },
  'wechat.com': weixin,
  'weixin.qq.com': weixin,
  'matrix.org': { pack: 'si', key: 'SiMatrix', color: '#000000' },

  // Video & streaming
  'youtube.com': youtube,
  'youtu.be': youtube,
  'twitch.tv': { pack: 'fa', key: 'FaTwitch', color: '#9146ff' },
  'vimeo.com': { pack: 'fa', key: 'FaVimeo', color: '#1ab7ea' },
  'tiktok.com': tiktok,
  'vm.tiktok.com': tiktok,

  // Music & audio
  'spotify.com': spotify,
  'open.spotify.com': spotify,
  'music.apple.com': apple,
  'itunes.apple.com': apple,
  'soundcloud.com': { pack: 'fa', key: 'FaSoundcloud', color: '#ff5500' },
  'bandcamp.com': { pack: 'fa', key: 'FaBandcamp', color: '#629aa9' },
  'last.fm': lastfm,
  'lastfm.com': lastfm,

  // Developer & tech
  'github.com': github,
  'gitlab.com': { pack: 'fa', key: 'FaGitlab', color: '#fc6d26' },
  'bitbucket.org': { pack: 'fa', key: 'FaBitbucket', color: '#0052cc' },
  'stackoverflow.com': { pack: 'fa', key: 'FaStackOverflow', color: '#f48024' },
  'codepen.io': { pack: 'fa', key: 'FaCodepen', color: '#131417' },
  'dev.to': { pack: 'fa', key: 'FaDev', color: '#0a0a0a' },
  'hashnode.com': hashnode,
  'hashnode.dev': hashnode,
  'npmjs.com': { pack: 'fa', key: 'FaNpm', color: '#cb3837' },
  'leetcode.com': { pack: 'si', key: 'SiLeetcode', color: '#ffa116' },
  'codewars.com': { pack: 'si', key: 'SiCodewars', color: '#b1361e' },
  'figma.com': { pack: 'fa', key: 'FaFigma', color: '#f24e1e' },
  'notion.so': notion,
  'notion.site': notion,
  'trello.com': { pack: 'fa', key: 'FaTrello', color: '#0052cc' },

  // Blogging & publishing
  'medium.com': { pack: 'fa', key: 'FaMedium', color: '#000000' },
  'substack.com': { pack: 'si', key: 'SiSubstack', color: '#ff6719' },

  // Design & photography
  'dribbble.com': { pack: 'fa', key: 'FaDribbble', color: '#ea4c89' },
  'behance.net': behance,
  'be.net': behance,
  'flickr.com': flickr,
  'flic.kr': flickr,

  // Creator economy & funding
  'patreon.com': { pack: 'fa', key: 'FaPatreon', color: '#ff424d' },
  'ko-fi.com': { pack: 'si', key: 'SiKofi', color: '#ff5e5b' },
  'buymeacoffee.com': { pack: 'si', key: 'SiBuymeacoffee', color: '#ffdd00' },
  'gumroad.com': { pack: 'si', key: 'SiGumroad', color: '#ff90e8' },
  'kickstarter.com': { pack: 'fa', key: 'FaKickstarter', color: '#05ce78' },

  // Freelance & marketplace
  'fiverr.com': { pack: 'si', key: 'SiFiverr', color: '#1dbf73' },
  'upwork.com': { pack: 'si', key: 'SiUpwork', color: '#14a800' },
  'etsy.com': { pack: 'fa', key: 'FaEtsy', color: '#f16521' },
  'shopify.com': { pack: 'fa', key: 'FaShopify', color: '#96bf48' },
  'amazon.com': amazon,
  'amazon.co.uk': amazon,
  'amazon.de': amazon,
  'amazon.co.jp': amazon,
  'amazon.in': amazon,
  'amzn.to': amazon,

  // Payments
  'paypal.com': paypal,
  'paypal.me': paypal,
  'stripe.com': { pack: 'fa', key: 'FaStripe', color: '#6772e5' },

  // Scheduling & productivity
  'calendly.com': { pack: 'si', key: 'SiCalendly', color: '#006bff' },

  // Link-in-bio & profiles
  'linktr.ee': { pack: 'si', key: 'SiLinktree', color: '#39e09b' },
  'bento.me': { pack: 'si', key: 'SiBento', color: '#ff6347' },

  // Gaming
  'store.steampowered.com': { pack: 'fa', key: 'FaSteam', color: '#00adee' },
  'steamcommunity.com': { pack: 'fa', key: 'FaSteam', color: '#00adee' },

  // Books & knowledge
  'goodreads.com': { pack: 'fa', key: 'FaGoodreads', color: '#553b08' },

  // News & discovery
  'producthunt.com': { pack: 'fa', key: 'FaProductHunt', color: '#da552f' },
  'news.ycombinator.com': { pack: 'fa', key: 'FaHackerNews', color: '#f0652f' }
}

let faPromise: Promise<IconModule> | null = null
let fa6Promise: Promise<IconModule> | null = null
let siPromise: Promise<IconModule> | null = null

const loadPack = (pack: IconPack): Promise<IconModule> => {
  if (pack === 'fa')
    return (faPromise ??= import('react-icons/fa') as unknown as Promise<IconModule>)
  if (pack === 'fa6')
    return (fa6Promise ??= import('react-icons/fa6') as unknown as Promise<IconModule>)
  return (siPromise ??= import('react-icons/si') as unknown as Promise<IconModule>)
}

export const loadIconForDomain = async (domain: string): Promise<IconComponent | null> => {
  const entry = SOCIAL_ICONS[domain]
  if (!entry) return null
  const mod = await loadPack(entry.pack)
  return mod[entry.key] ?? null
}

export const getSocialColor = (domain: string): string | undefined => SOCIAL_ICONS[domain]?.color

export const isSocialDomain = (domain: string): boolean => domain in SOCIAL_ICONS
