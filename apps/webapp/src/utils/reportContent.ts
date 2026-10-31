import { LEGAL_CONTACT_EMAIL } from '@components/pages/legal/legalMetadata'

export type ReportKind = 'document' | 'message'

const SUBJECT: Record<ReportKind, string> = {
  document: 'Report a document',
  message: 'Report a message'
}

/**
 * A mailto opens in the reporter's own mail client, so document text, message
 * text and their profile stay out. The link and the kind are the whole payload.
 */
export const buildReportMailto = (kind: ReportKind, url: string): string => {
  const body = `Link: ${url}\n\nWhat is wrong:\n\n`

  // encodeURIComponent, not URLSearchParams — the latter writes a space as "+",
  // which mail clients show literally in the subject line.
  const query = `subject=${encodeURIComponent(SUBJECT[kind])}&body=${encodeURIComponent(body)}`

  return `mailto:${LEGAL_CONTACT_EMAIL}?${query}`
}

export const openReportMail = (kind: ReportKind, url: string): void => {
  window.location.href = buildReportMailto(kind, url)
}

/** Pad route only. Home and /editor would mail a path that is not a document. */
export const isDocumentReportPath = (pathname: string): boolean => pathname === '/[...slugs]'
