import type { ComponentType, CSSProperties } from 'react'

import type { SocialIconKey } from './socialIconComponents'

interface IconEntry {
  key: SocialIconKey
  color: string
}

export type IconComponent = ComponentType<{
  size?: number
  className?: string
  style?: CSSProperties
}>

const facebook: IconEntry = { key: 'FaFacebook', color: '#1877f2' }
const instagram: IconEntry = { key: 'FaInstagram', color: '#e4405f' }
const xTwitter: IconEntry = { key: 'FaXTwitter', color: '#000000' }
const linkedin: IconEntry = { key: 'FaLinkedin', color: '#0077b5' }
const reddit: IconEntry = { key: 'FaReddit', color: '#ff4500' }
const pinterest: IconEntry = { key: 'FaPinterest', color: '#bd081c' }
const mastodonSi: IconEntry = { key: 'SiMastodon', color: '#6364ff' }
const mastodonFa: IconEntry = { key: 'FaMastodon', color: '#6364ff' }
const whatsapp: IconEntry = { key: 'FaWhatsapp', color: '#25d366' }
const telegram: IconEntry = { key: 'FaTelegram', color: '#26a5e4' }
const discord: IconEntry = { key: 'FaDiscord', color: '#5865f2' }
const snapchat: IconEntry = { key: 'FaSnapchat', color: '#fffc00' }
const skype: IconEntry = { key: 'FaSkype', color: '#00aff0' }
const weixin: IconEntry = { key: 'FaWeixin', color: '#07c160' }
const youtube: IconEntry = { key: 'FaYoutube', color: '#ff0000' }
const tiktok: IconEntry = { key: 'FaTiktok', color: '#010101' }
const spotify: IconEntry = { key: 'FaSpotify', color: '#1db954' }
const apple: IconEntry = { key: 'FaApple', color: '#fc3c44' }
const lastfm: IconEntry = { key: 'FaLastfm', color: '#d51007' }
const github: IconEntry = { key: 'FaGithub', color: '#181717' }
const hashnode: IconEntry = { key: 'SiHashnode', color: '#2962ff' }
const notion: IconEntry = { key: 'SiNotion', color: '#000000' }
const behance: IconEntry = { key: 'FaBehance', color: '#1769ff' }
const flickr: IconEntry = { key: 'FaFlickr', color: '#0063dc' }
const paypal: IconEntry = { key: 'FaPaypal', color: '#003087' }
const amazon: IconEntry = { key: 'FaAmazon', color: '#ff9900' }

/**
 * Domain → icon entry. Aliases (e.g. `fb.com` vs `facebook.com`) share the
 * same entry, so they resolve to the same icon.
 */
export const SOCIAL_ICONS: Record<string, IconEntry> = {
  'facebook.com': facebook,
  'fb.com': facebook,
  'instagram.com': instagram,
  'instagr.am': instagram,
  'twitter.com': xTwitter,
  'x.com': xTwitter,
  'threads.net': { key: 'SiThreads', color: '#000000' },
  'bsky.app': { key: 'SiBluesky', color: '#0085ff' },
  'linkedin.com': linkedin,
  'lnkd.in': linkedin,
  'reddit.com': reddit,
  'redd.it': reddit,
  'tumblr.com': { key: 'FaTumblr', color: '#35465c' },
  'pinterest.com': pinterest,
  'pin.it': pinterest,
  'quora.com': { key: 'FaQuora', color: '#b92b27' },
  'mastodon.social': mastodonSi,
  'mastodon.online': mastodonFa,
  'vk.com': { key: 'FaVk', color: '#4c75a3' },
  'clubhouse.com': { key: 'SiClubhouse', color: '#f2e6d9' },

  'whatsapp.com': whatsapp,
  'wa.me': whatsapp,
  'telegram.org': telegram,
  't.me': telegram,
  'discord.com': discord,
  'discord.gg': discord,
  'signal.org': { key: 'SiSignal', color: '#3a76f0' },
  'snapchat.com': snapchat,
  'snap.com': snapchat,
  'slack.com': { key: 'FaSlack', color: '#4a154b' },
  'skype.com': skype,
  'join.skype.com': skype,
  'zoom.us': { key: 'SiZoom', color: '#0b5cff' },
  'line.me': { key: 'SiLine', color: '#00c300' },
  'wechat.com': weixin,
  'weixin.qq.com': weixin,
  'matrix.org': { key: 'SiMatrix', color: '#000000' },

  'youtube.com': youtube,
  'youtu.be': youtube,
  'twitch.tv': { key: 'FaTwitch', color: '#9146ff' },
  'vimeo.com': { key: 'FaVimeo', color: '#1ab7ea' },
  'tiktok.com': tiktok,
  'vm.tiktok.com': tiktok,

  'spotify.com': spotify,
  'open.spotify.com': spotify,
  'music.apple.com': apple,
  'itunes.apple.com': apple,
  'soundcloud.com': { key: 'FaSoundcloud', color: '#ff5500' },
  'bandcamp.com': { key: 'FaBandcamp', color: '#629aa9' },
  'last.fm': lastfm,
  'lastfm.com': lastfm,

  'github.com': github,
  'gitlab.com': { key: 'FaGitlab', color: '#fc6d26' },
  'bitbucket.org': { key: 'FaBitbucket', color: '#0052cc' },
  'stackoverflow.com': { key: 'FaStackOverflow', color: '#f48024' },
  'codepen.io': { key: 'FaCodepen', color: '#131417' },
  'dev.to': { key: 'FaDev', color: '#0a0a0a' },
  'hashnode.com': hashnode,
  'hashnode.dev': hashnode,
  'npmjs.com': { key: 'FaNpm', color: '#cb3837' },
  'leetcode.com': { key: 'SiLeetcode', color: '#ffa116' },
  'codewars.com': { key: 'SiCodewars', color: '#b1361e' },
  'figma.com': { key: 'FaFigma', color: '#f24e1e' },
  'notion.so': notion,
  'notion.site': notion,
  'trello.com': { key: 'FaTrello', color: '#0052cc' },

  'medium.com': { key: 'FaMedium', color: '#000000' },
  'substack.com': { key: 'SiSubstack', color: '#ff6719' },

  'dribbble.com': { key: 'FaDribbble', color: '#ea4c89' },
  'behance.net': behance,
  'be.net': behance,
  'flickr.com': flickr,
  'flic.kr': flickr,

  'patreon.com': { key: 'FaPatreon', color: '#ff424d' },
  'ko-fi.com': { key: 'SiKofi', color: '#ff5e5b' },
  'buymeacoffee.com': { key: 'SiBuymeacoffee', color: '#ffdd00' },
  'gumroad.com': { key: 'SiGumroad', color: '#ff90e8' },
  'kickstarter.com': { key: 'FaKickstarter', color: '#05ce78' },

  'fiverr.com': { key: 'SiFiverr', color: '#1dbf73' },
  'upwork.com': { key: 'SiUpwork', color: '#14a800' },
  'etsy.com': { key: 'FaEtsy', color: '#f16521' },
  'shopify.com': { key: 'FaShopify', color: '#96bf48' },
  'amazon.com': amazon,
  'amazon.co.uk': amazon,
  'amazon.de': amazon,
  'amazon.co.jp': amazon,
  'amazon.in': amazon,
  'amzn.to': amazon,

  'paypal.com': paypal,
  'paypal.me': paypal,
  'stripe.com': { key: 'FaStripe', color: '#6772e5' },

  'calendly.com': { key: 'SiCalendly', color: '#006bff' },

  'linktr.ee': { key: 'SiLinktree', color: '#39e09b' },
  'bento.me': { key: 'SiBento', color: '#ff6347' },

  'store.steampowered.com': { key: 'FaSteam', color: '#00adee' },
  'steamcommunity.com': { key: 'FaSteam', color: '#00adee' },

  'goodreads.com': { key: 'FaGoodreads', color: '#553b08' },

  'producthunt.com': { key: 'FaProductHunt', color: '#da552f' },
  'news.ycombinator.com': { key: 'FaHackerNews', color: '#f0652f' }
}

let componentsPromise: Promise<Record<SocialIconKey, IconComponent>> | null = null

export const loadIconForDomain = async (domain: string): Promise<IconComponent | null> => {
  const entry = SOCIAL_ICONS[domain]
  if (!entry) return null
  componentsPromise ??= import('./socialIconComponents').then((m) => m.SOCIAL_ICON_COMPONENTS)
  return (await componentsPromise)[entry.key] ?? null
}

export const getSocialColor = (domain: string): string | undefined => SOCIAL_ICONS[domain]?.color

export const isSocialDomain = (domain: string): boolean => domain in SOCIAL_ICONS
