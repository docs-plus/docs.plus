import { sanitizePlainText } from '../../../lib/sanitizePlainText'

const WHITESPACE_RUN = /\s+/g

/**
 * The plain-text MIME part of an email has no escaping to offer, and a public
 * document takes anonymous writes. A newline here forges a whole entry.
 */
export const sanitizeText = (value: string, maxChars: number): string =>
  sanitizePlainText(value, maxChars)

export const countWords = (value: string): number =>
  value.split(WHITESPACE_RUN).filter((word) => word.length > 0).length
