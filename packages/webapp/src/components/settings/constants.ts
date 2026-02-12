import { FaBehance, FaDribbble, FaPatreon } from 'react-icons/fa'
import { FaFacebook, FaReddit, FaTwitter, FaWhatsapp, FaYoutube } from 'react-icons/fa'
import {
  FaAmazon,
  FaApple,
  FaBandcamp,
  FaDiscord,
  FaGithub,
  FaGitlab,
  FaLinkedin,
  FaPaypal,
  FaPinterest,
  FaShopify,
  FaSnapchat,
  FaSoundcloud,
  FaSpotify,
  FaStackOverflow,
  FaStripe,
  FaTelegram,
  FaTiktok,
  FaTumblr,
  FaTwitch,
  FaVimeo,
  FaVk
} from 'react-icons/fa'
import { SiBento, SiCalendly, SiLine, SiLinktree, SiThreads } from 'react-icons/si'

export const SOCIAL_MEDIA_ICONS: {
  [key: string]: {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
    color: string
  }
} = {
  'facebook.com': { icon: FaFacebook, color: '#3b5998' },
  'fb.com': { icon: FaFacebook, color: '#3b5998' },
  'twitter.com': { icon: FaTwitter, color: '#1da1f2' },
  'x.com': { icon: FaTwitter, color: '#1da1f2' },
  'youtube.com': { icon: FaYoutube, color: '#ff0000' },
  'youtu.be': { icon: FaYoutube, color: '#ff0000' },
  'reddit.com': { icon: FaReddit, color: '#ff4500' },
  'redd.it': { icon: FaReddit, color: '#ff4500' },
  'whatsapp.com': { icon: FaWhatsapp, color: '#25d366' },
  'wa.me': { icon: FaWhatsapp, color: '#25d366' },
  'twitch.tv': { icon: FaTwitch, color: '#6441a5' },
  'stripe.com': { icon: FaStripe, color: '#6772e5' },
  'snapchat.com': { icon: FaSnapchat, color: '#fffc00' },
  'snap.com': { icon: FaSnapchat, color: '#fffc00' },
  'shopify.com': { icon: FaShopify, color: '#96bf48' },
  'spotify.com': { icon: FaSpotify, color: '#1db954' },
  'open.spotify.com': { icon: FaSpotify, color: '#1db954' },
  'music.apple.com': { icon: FaApple, color: '#000000' },
  'itunes.apple.com': { icon: FaApple, color: '#000000' },
  'linkedin.com': { icon: FaLinkedin, color: '#0077b5' },
  'lnkd.in': { icon: FaLinkedin, color: '#0077b5' },
  'discord.com': { icon: FaDiscord, color: '#7289da' },
  'discord.gg': { icon: FaDiscord, color: '#7289da' },
  'soundcloud.com': { icon: FaSoundcloud, color: '#ff5500' },
  'amazon.com': { icon: FaAmazon, color: '#ff9900' },
  'amazon.co.uk': { icon: FaAmazon, color: '#ff9900' },
  'amazon.de': { icon: FaAmazon, color: '#ff9900' },
  'amazon.co.jp': { icon: FaAmazon, color: '#ff9900' },
  'amazon.in': { icon: FaAmazon, color: '#ff9900' },
  'amzn.to': { icon: FaAmazon, color: '#ff9900' },
  'pinterest.com': { icon: FaPinterest, color: '#bd081c' },
  'threads.net': { icon: SiThreads, color: '#000000' },
  'tiktok.com': { icon: FaTiktok, color: '#010101' },
  'telegram.org': { icon: FaTelegram, color: '#0088cc' },
  'github.com': { icon: FaGithub, color: '#181717' },
  'calendly.com': { icon: SiCalendly, color: '#00a2ff' },
  'patreon.com': { icon: FaPatreon, color: '#f96854' },
  'bento.me': { icon: SiBento, color: '#ff6347' },
  'bandcamp.com': { icon: FaBandcamp, color: '#629aa9' },
  'line.me': { icon: SiLine, color: '#00c300' },
  't.me': { icon: FaTelegram, color: '#0088cc' },
  'dribbble.com': { icon: FaDribbble, color: '#ea4c89' },
  'vimeo.com': { icon: FaVimeo, color: '#1ab7ea' },
  'paypal.com': { icon: FaPaypal, color: '#003087' },
  'paypal.me': { icon: FaPaypal, color: '#003087' },
  'gitlab.com': { icon: FaGitlab, color: '#fc6d26' },
  'stackoverflow.com': { icon: FaStackOverflow, color: '#f48024' },
  'tumblr.com': { icon: FaTumblr, color: '#35465c' },
  'vk.com': { icon: FaVk, color: '#4c75a3' },
  'vm.tiktok.com': { icon: FaTiktok, color: '#010101' },
  'pin.it': { icon: FaPinterest, color: '#bd081c' },
  'linktr.ee': { icon: SiLinktree, color: '#39e09b' },
  'behance.net': { icon: FaBehance, color: '#1769ff' },
  'be.net': { icon: FaBehance, color: '#1769ff' }
}

// Derived from SOCIAL_MEDIA_ICONS keys — single source of truth (DRY)
export const SOCIAL_MEDIA_DOMAINS = Object.keys(SOCIAL_MEDIA_ICONS)
