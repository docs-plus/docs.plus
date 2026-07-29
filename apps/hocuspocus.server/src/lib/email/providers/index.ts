import { emailLogger } from '../../logger'
import { resendProvider } from './resend'
import { sendgridProvider } from './sendgrid'
import { smtpProvider } from './smtp'
import type { EmailMessage, EmailProvider, EmailProviderInterface, SendResult } from './types'

const providers: Record<EmailProvider, EmailProviderInterface> = {
  smtp: smtpProvider,
  resend: resendProvider,
  sendgrid: sendgridProvider
}

let activeProvider: EmailProviderInterface | null = null

export function getProvider(): EmailProviderInterface | null {
  if (activeProvider) return activeProvider

  const explicitProvider = process.env.EMAIL_PROVIDER as EmailProvider | undefined
  if (explicitProvider && providers[explicitProvider]?.isConfigured()) {
    activeProvider = providers[explicitProvider]
    emailLogger.info({ provider: activeProvider.name }, 'Email provider selected (explicit)')
    return activeProvider
  }

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

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const provider = getProvider()
  if (!provider) {
    return { success: false, error: 'No email provider configured' }
  }
  return provider.send(message)
}

export async function verifyProvider(): Promise<boolean> {
  const provider = getProvider()
  if (!provider) return false
  return provider.verify()
}

export function isAnyProviderConfigured(): boolean {
  return Object.values(providers).some((p) => p.isConfigured())
}

export function getProviderStatus(): {
  active: EmailProvider | null
  configured: EmailProvider[]
} {
  const configured = (Object.keys(providers) as EmailProvider[]).filter((name) =>
    providers[name].isConfigured()
  )

  return {
    active: getProvider()?.name || null,
    configured
  }
}

export type { EmailMessage, EmailProvider, EmailProviderInterface, SendResult } from './types'
