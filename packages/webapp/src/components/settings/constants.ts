import type { IconType } from 'react-icons'
import {
  FaAmazon,
  FaApple,
  FaBandcamp,
  FaBehance,
  FaBitbucket,
  FaCodepen,
  FaDev,
  FaDiscord,
  FaDribbble,
  FaEtsy,
  FaFacebook,
  FaFigma,
  FaFlickr,
  FaGithub,
  FaGitlab,
  FaGoodreads,
  FaHackerNews,
  FaInstagram,
  FaKickstarter,
  FaLastfm,
  FaLinkedin,
  FaMastodon,
  FaMedium,
  FaNpm,
  FaPatreon,
  FaPaypal,
  FaPinterest,
  FaProductHunt,
  FaQuora,
  FaReddit,
  FaShopify,
  FaSkype,
  FaSlack,
  FaSnapchat,
  FaSoundcloud,
  FaSpotify,
  FaStackOverflow,
  FaSteam,
  FaStripe,
  FaTelegram,
  FaTiktok,
  FaTrello,
  FaTumblr,
  FaTwitch,
  FaVimeo,
  FaVk,
  FaWeixin,
  FaWhatsapp,
  FaYoutube
} from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'
import {
  SiBento,
  SiBluesky,
  SiBuymeacoffee,
  SiCalendly,
  SiClubhouse,
  SiCodewars,
  SiFiverr,
  SiGumroad,
  SiHashnode,
  SiKofi,
  SiLeetcode,
  SiLine,
  SiLinktree,
  SiMastodon,
  SiMatrix,
  SiNotion,
  SiSignal,
  SiSubstack,
  SiThreads,
  SiUpwork,
  SiZoom
} from 'react-icons/si'

// --- Types ---

interface SocialMediaEntry {
  icon: IconType
  color: string
}

// --- Social Media Icon Registry ---
// Organized by category for maintainability. ~120 domain entries covering major platforms.

export const SOCIAL_MEDIA_ICONS: Record<string, SocialMediaEntry> = {
  // ── Social Networks ──────────────────────────────────────────────────
  'facebook.com': { icon: FaFacebook, color: '#1877f2' },
  'fb.com': { icon: FaFacebook, color: '#1877f2' },
  'instagram.com': { icon: FaInstagram, color: '#e4405f' },
  'instagr.am': { icon: FaInstagram, color: '#e4405f' },
  'twitter.com': { icon: FaXTwitter, color: '#000000' },
  'x.com': { icon: FaXTwitter, color: '#000000' },
  'threads.net': { icon: SiThreads, color: '#000000' },
  'bsky.app': { icon: SiBluesky, color: '#0085ff' },
  'linkedin.com': { icon: FaLinkedin, color: '#0077b5' },
  'lnkd.in': { icon: FaLinkedin, color: '#0077b5' },
  'reddit.com': { icon: FaReddit, color: '#ff4500' },
  'redd.it': { icon: FaReddit, color: '#ff4500' },
  'tumblr.com': { icon: FaTumblr, color: '#35465c' },
  'pinterest.com': { icon: FaPinterest, color: '#bd081c' },
  'pin.it': { icon: FaPinterest, color: '#bd081c' },
  'quora.com': { icon: FaQuora, color: '#b92b27' },
  'mastodon.social': { icon: SiMastodon, color: '#6364ff' },
  'mastodon.online': { icon: FaMastodon, color: '#6364ff' },
  'vk.com': { icon: FaVk, color: '#4c75a3' },
  'clubhouse.com': { icon: SiClubhouse, color: '#f2e6d9' },

  // ── Messaging ────────────────────────────────────────────────────────
  'whatsapp.com': { icon: FaWhatsapp, color: '#25d366' },
  'wa.me': { icon: FaWhatsapp, color: '#25d366' },
  'telegram.org': { icon: FaTelegram, color: '#26a5e4' },
  't.me': { icon: FaTelegram, color: '#26a5e4' },
  'discord.com': { icon: FaDiscord, color: '#5865f2' },
  'discord.gg': { icon: FaDiscord, color: '#5865f2' },
  'signal.org': { icon: SiSignal, color: '#3a76f0' },
  'snapchat.com': { icon: FaSnapchat, color: '#fffc00' },
  'snap.com': { icon: FaSnapchat, color: '#fffc00' },
  'slack.com': { icon: FaSlack, color: '#4a154b' },
  'skype.com': { icon: FaSkype, color: '#00aff0' },
  'join.skype.com': { icon: FaSkype, color: '#00aff0' },
  'zoom.us': { icon: SiZoom, color: '#0b5cff' },
  'line.me': { icon: SiLine, color: '#00c300' },
  'wechat.com': { icon: FaWeixin, color: '#07c160' },
  'weixin.qq.com': { icon: FaWeixin, color: '#07c160' },
  'matrix.org': { icon: SiMatrix, color: '#000000' },

  // ── Video & Streaming ────────────────────────────────────────────────
  'youtube.com': { icon: FaYoutube, color: '#ff0000' },
  'youtu.be': { icon: FaYoutube, color: '#ff0000' },
  'twitch.tv': { icon: FaTwitch, color: '#9146ff' },
  'vimeo.com': { icon: FaVimeo, color: '#1ab7ea' },
  'tiktok.com': { icon: FaTiktok, color: '#010101' },
  'vm.tiktok.com': { icon: FaTiktok, color: '#010101' },

  // ── Music & Audio ────────────────────────────────────────────────────
  'spotify.com': { icon: FaSpotify, color: '#1db954' },
  'open.spotify.com': { icon: FaSpotify, color: '#1db954' },
  'music.apple.com': { icon: FaApple, color: '#fc3c44' },
  'itunes.apple.com': { icon: FaApple, color: '#fc3c44' },
  'soundcloud.com': { icon: FaSoundcloud, color: '#ff5500' },
  'bandcamp.com': { icon: FaBandcamp, color: '#629aa9' },
  'last.fm': { icon: FaLastfm, color: '#d51007' },
  'lastfm.com': { icon: FaLastfm, color: '#d51007' },

  // ── Developer & Tech ─────────────────────────────────────────────────
  'github.com': { icon: FaGithub, color: '#181717' },
  'gitlab.com': { icon: FaGitlab, color: '#fc6d26' },
  'bitbucket.org': { icon: FaBitbucket, color: '#0052cc' },
  'stackoverflow.com': { icon: FaStackOverflow, color: '#f48024' },
  'codepen.io': { icon: FaCodepen, color: '#131417' },
  'dev.to': { icon: FaDev, color: '#0a0a0a' },
  'hashnode.com': { icon: SiHashnode, color: '#2962ff' },
  'hashnode.dev': { icon: SiHashnode, color: '#2962ff' },
  'npmjs.com': { icon: FaNpm, color: '#cb3837' },
  'leetcode.com': { icon: SiLeetcode, color: '#ffa116' },
  'codewars.com': { icon: SiCodewars, color: '#b1361e' },
  'figma.com': { icon: FaFigma, color: '#f24e1e' },
  'notion.so': { icon: SiNotion, color: '#000000' },
  'notion.site': { icon: SiNotion, color: '#000000' },
  'trello.com': { icon: FaTrello, color: '#0052cc' },

  // ── Blogging & Publishing ────────────────────────────────────────────
  'medium.com': { icon: FaMedium, color: '#000000' },
  'substack.com': { icon: SiSubstack, color: '#ff6719' },

  // ── Design & Photography ─────────────────────────────────────────────
  'dribbble.com': { icon: FaDribbble, color: '#ea4c89' },
  'behance.net': { icon: FaBehance, color: '#1769ff' },
  'be.net': { icon: FaBehance, color: '#1769ff' },
  'flickr.com': { icon: FaFlickr, color: '#0063dc' },
  'flic.kr': { icon: FaFlickr, color: '#0063dc' },

  // ── Creator Economy & Funding ────────────────────────────────────────
  'patreon.com': { icon: FaPatreon, color: '#ff424d' },
  'ko-fi.com': { icon: SiKofi, color: '#ff5e5b' },
  'buymeacoffee.com': { icon: SiBuymeacoffee, color: '#ffdd00' },
  'gumroad.com': { icon: SiGumroad, color: '#ff90e8' },
  'kickstarter.com': { icon: FaKickstarter, color: '#05ce78' },

  // ── Freelance & Marketplace ──────────────────────────────────────────
  'fiverr.com': { icon: SiFiverr, color: '#1dbf73' },
  'upwork.com': { icon: SiUpwork, color: '#14a800' },
  'etsy.com': { icon: FaEtsy, color: '#f16521' },
  'shopify.com': { icon: FaShopify, color: '#96bf48' },
  'amazon.com': { icon: FaAmazon, color: '#ff9900' },
  'amazon.co.uk': { icon: FaAmazon, color: '#ff9900' },
  'amazon.de': { icon: FaAmazon, color: '#ff9900' },
  'amazon.co.jp': { icon: FaAmazon, color: '#ff9900' },
  'amazon.in': { icon: FaAmazon, color: '#ff9900' },
  'amzn.to': { icon: FaAmazon, color: '#ff9900' },

  // ── Payments ─────────────────────────────────────────────────────────
  'paypal.com': { icon: FaPaypal, color: '#003087' },
  'paypal.me': { icon: FaPaypal, color: '#003087' },
  'stripe.com': { icon: FaStripe, color: '#6772e5' },

  // ── Scheduling & Productivity ────────────────────────────────────────
  'calendly.com': { icon: SiCalendly, color: '#006bff' },

  // ── Link-in-Bio & Profiles ──────────────────────────────────────────
  'linktr.ee': { icon: SiLinktree, color: '#39e09b' },
  'bento.me': { icon: SiBento, color: '#ff6347' },

  // ── Gaming ───────────────────────────────────────────────────────────
  'store.steampowered.com': { icon: FaSteam, color: '#00adee' },
  'steamcommunity.com': { icon: FaSteam, color: '#00adee' },

  // ── Books & Knowledge ────────────────────────────────────────────────
  'goodreads.com': { icon: FaGoodreads, color: '#553b08' },

  // ── News & Discovery ─────────────────────────────────────────────────
  'producthunt.com': { icon: FaProductHunt, color: '#da552f' },
  'news.ycombinator.com': { icon: FaHackerNews, color: '#f0652f' }
}

// --- Domain Helpers (DRY — derived from SOCIAL_MEDIA_ICONS, single source of truth) ---

/** Check if a domain is a known social media platform. */
export const isSocialDomain = (domain: string): boolean => domain in SOCIAL_MEDIA_ICONS

/** Get the brand icon component for a social media domain, or undefined. */
export const getSocialIcon = (domain: string): IconType | undefined =>
  SOCIAL_MEDIA_ICONS[domain]?.icon

/** Get the brand color for a social media domain, or undefined. */
export const getSocialColor = (domain: string): string | undefined =>
  SOCIAL_MEDIA_ICONS[domain]?.color

// Legacy export — derived from keys (kept for backward compatibility with UserProfileDialog)
export const SOCIAL_MEDIA_DOMAINS = Object.keys(SOCIAL_MEDIA_ICONS)
