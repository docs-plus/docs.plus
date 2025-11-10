import { ELinkType } from '../types'
import { SOCIAL_MEDIA_DOMAINS } from '../constants'

export const useLinkValidation = () => {
  const validateLink = (url: string): { valid: boolean; type?: ELinkType; error?: string } => {
    const trimmedUrl = url.trim()

    // Phone number detection (supports various formats including international)
    const phoneRegex = /^(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,}\)?[-.\s]?\d{1,}[-.\s]?\d{1,}$/
    if (phoneRegex.test(trimmedUrl.replace(/\s+/g, ''))) {
      return { valid: true, type: ELinkType.Phone }
    }

    // Email detection
    if (/^mailto:/.test(trimmedUrl) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedUrl)) {
      return { valid: true, type: ELinkType.Email }
    }

    // URL validation
    try {
      const formattedUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`
      const parsedUrl = new URL(formattedUrl)
      const domain = parsedUrl.hostname.replace('www.', '').toLowerCase()
      const type = SOCIAL_MEDIA_DOMAINS.includes(domain) ? ELinkType.Social : ELinkType.Simple
      return { valid: true, type }
    } catch (e) {
      return { valid: false, error: 'Invalid URL format!' }
    }
  }

  return { validateLink }
}
