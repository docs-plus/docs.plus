/**
 * Email Provider Manager
 *
 * Dynamically selects and manages email providers.
 *
 * Provider selection (in order of priority):
 * 1. EMAIL_PROVIDER env var (explicit choice)
 * 2. First configured provider (auto-detect)
 *
 * Supported providers:
 * - smtp: Built-in SMTP via Nodemailer
 * - resend: Resend API (https://resend.com)
 * - sendgrid: SendGrid API (https://sendgrid.com)
 */

import { emailLogger } from '../../logger'
import { smtpProvider } from './smtp'
import { resendProvider } from './resend'
import { sendgridProvider } from './sendgrid'
import type { EmailProvider, EmailProviderInterface, EmailMessage, SendResult } from './types'

// All available providers
const providers: Record<EmailProvider, EmailProviderInterface> = {
  smtp: smtpProvider,
  resend: resendProvider,
  sendgrid: sendgridProvider
}

// Active provider (lazy-initialized)
let activeProvider: EmailProviderInterface | null = null

/**
 * Get the active email provider
 *
 * Selection logic:
 * 1. Use EMAIL_PROVIDER env if set and configured
 * 2. Otherwise, use first configured provider
 * 3. Returns null if no provider is configured
 */
export function getProvider(): EmailProviderInterface | null {
  if (activeProvider) return activeProvider

  // Check explicit provider setting
  const explicitProvider = process.env.EMAIL_PROVIDER as EmailProvider | undefined
  if (explicitProvider && providers[explicitProvider]?.isConfigured()) {
    activeProvider = providers[explicitProvider]
    emailLogger.info({ provider: activeProvider.name }, 'Email provider selected (explicit)')
    return activeProvider
  }

  // Auto-detect: try providers in order of preference
  const preferenceOrder: EmailProvider[] = ['resend', 'sendgrid', 'smtp']
  for (const name of preferenceOrder) {
    if (providers[name].isConfigured()) {
      activeProvider = providers[name]
      emailLogger.info({ provider: activeProvider.name }, 'Email provider selected (auto-detect)')
      return activeProvider
    }
  }

  emailLogger.warn('No email provider configured')
  return null
}

/**
 * Send email using the active provider
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const provider = getProvider()
  if (!provider) {
    return { success: false, error: 'No email provider configured' }
  }
  return provider.send(message)
}

/**
 * Verify the active provider connection
 */
export async function verifyProvider(): Promise<boolean> {
  const provider = getProvider()
  if (!provider) return false
  return provider.verify()
}

/**
 * Check if any email provider is configured
 */
export function isAnyProviderConfigured(): boolean {
  return Object.values(providers).some(p => p.isConfigured())
}

/**
 * Get provider status for health checks
 */
export function getProviderStatus(): {
  active: EmailProvider | null
  configured: EmailProvider[]
} {
  const configured = (Object.keys(providers) as EmailProvider[])
    .filter(name => providers[name].isConfigured())

  return {
    active: getProvider()?.name || null,
    configured
  }
}

// Re-export types
export type { EmailProvider, EmailProviderInterface, EmailMessage, SendResult } from './types'
