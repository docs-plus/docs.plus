import type { DeliveryEvent } from '../types'

interface ResendEventData {
  to?: unknown
  tags?: unknown
  bounce?: { type?: unknown; subType?: unknown }
  failed?: { reason?: unknown }
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

/**
 * Maps a Resend webhook payload. `namespaceTag` is this server's `ns` tag in
 * Resend's cleaned form. Only an event that carries a different `ns` is ignored:
 * Supabase Auth mail has no tags, and its bounces still count.
 */
export function toDeliveryEvent(payload: unknown, namespaceTag: string | null): DeliveryEvent {
  const { type, data } = (payload ?? {}) as { type?: unknown; data?: ResendEventData }
  if (!data) return { type: 'ignored' }

  // Resend sends tags back as an object, not the list it takes at send time.
  const tags = (data.tags && typeof data.tags === 'object' ? data.tags : {}) as Record<
    string,
    unknown
  >
  const ns = text(tags.ns)
  if (ns && namespaceTag && ns !== namespaceTag) return { type: 'ignored' }

  const emails = (Array.isArray(data.to) ? data.to : []).filter(
    (to): to is string => typeof to === 'string' && to.includes('@')
  )
  if (emails.length === 0) return { type: 'ignored' }
  const jobId = text(tags.job_id)

  switch (type) {
    case 'email.bounced':
      // A Temporary or Undetermined bounce is not a dead address.
      return data.bounce?.type === 'Permanent'
        ? { type: 'bounce', emails, reason: text(data.bounce.subType), jobId }
        : { type: 'ignored' }
    case 'email.complained':
      return { type: 'complaint', emails, jobId }
    case 'email.suppressed':
      return { type: 'suppressed', emails, reason: 'resend-suppressed', jobId }
    case 'email.failed':
      return { type: 'failed', emails, reason: text(data.failed?.reason) ?? 'unknown', jobId }
    default:
      return { type: 'ignored' }
  }
}
