import { config } from '../../../config/env'
import { createResendProvider } from './resend'
import { createSmtpProvider } from './smtp'
import type { EmailProvider, EmailProviderConfig } from './types'

/** Adding a provider is one case here, plus its branch in config/email.ts. */
function createEmailProvider(cfg: EmailProviderConfig): EmailProvider {
  switch (cfg.name) {
    case 'resend':
      return createResendProvider(cfg)
    case 'smtp':
      return createSmtpProvider(cfg)
  }
}

let provider: EmailProvider | null = null

export function getEmailProvider(): EmailProvider | null {
  const delivery = config.email.delivery
  if (delivery.status !== 'ready') return null
  provider ??= createEmailProvider(delivery.provider)
  return provider
}

/** Closes only a provider this process built, so shutdown never opens a pool. */
export async function closeEmailProvider(): Promise<void> {
  const current = provider
  provider = null
  await current?.close()
}
