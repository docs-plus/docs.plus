import * as cookie from 'cookie'
import Config from '@config'
import { type GetServerSidePropsContext } from 'next'

export const validateTurnstileAccess = (context: GetServerSidePropsContext): boolean => {
  const cookies = cookie.parse(context.req.headers.cookie || '')

  // Always challenge bots and suspicious traffic
  const userAgent = context.req.headers['user-agent'] || ''
  const botPatterns = [
    // Generic patterns
    'bot',
    'crawler',
    'spider',
    'scraper',
    // Tools & scripts
    'curl',
    'wget',
    'python',
    'java',
    'ruby',
    'go-http',
    'postman',
    'insomnia',
    'httpie',
    // Social media bots
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    // Search engines
    'googlebot',
    'bingbot',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'sogou',
    'msnbot',
    'applebot',
    // SEO & monitoring
    'ahrefsbot',
    'semrushbot',
    'mj12bot',
    'dotbot',
    'blexbot',
    'petalbot',
    'bytedance',
    'facebot',
    // Archives & misc
    'ia_archiver',
    'wayback'
  ]

  const isBot = new RegExp(botPatterns.join('|'), 'i').test(userAgent)
  if (isBot) return false // Always challenge bots

  const isTurnstileVerified = Config.app.turnstile.isEnabled
    ? cookies.turnstileVerified === 'true'
    : true

  return isTurnstileVerified
}
