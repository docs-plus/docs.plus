import {
  formatCount,
  IMPORT_CONTENT_MB,
  IMPORT_MAX_DEPTH,
  IMPORT_MAX_NODES,
  MARKDOWN_IMPORT_CHARS,
  OWNER_WORD_IMPORT_MB,
  WORD_IMPORT_MB
} from './importCaps'

/**
 * The conversion API's own error strings name byte limits and field names, which
 * is right for an API client and wrong for a person. One table, both endpoints.
 */
const BY_STATUS: Record<number, string> = {
  401: 'Your session has expired. Reload the page and sign in again.',
  403: 'You don’t have access to this document.',
  404: 'This document no longer exists. Reload the page.',
  413: `That file is too big. The document owner can import Word files up to ${OWNER_WORD_IMPORT_MB} MB, and everyone else up to ${WORD_IMPORT_MB} MB. Markdown is capped at ${formatCount(MARKDOWN_IMPORT_CHARS)} characters.`,
  415: 'Old .doc files aren’t supported. Open it in Word, save it as .docx, and try again.',
  422: 'That file couldn’t be read. It may be damaged, or not a Word or Markdown file.'
}

const SPLIT_IT = 'Split the file and import each part into its own document.'

// Three 413s refuse the converted result, not the file size, so they need their own words.
const BY_CODE: Record<string, string> = {
  TOO_MANY_NODES: `That file has too much in it for one document. A document holds at most ${formatCount(IMPORT_MAX_NODES)} parts. Each paragraph, heading and list item is a part, and so is each change in formatting. ${SPLIT_IT}`,
  TOO_DEEP: `That file nests too deeply for one document. A document allows at most ${IMPORT_MAX_DEPTH} levels, such as a quote inside a quote. Remove some of the nesting and try again.`,
  TOO_LARGE_TO_OPEN: `That file would make a document too large to open in a browser. A document can hold about ${IMPORT_CONTENT_MB} MB of content. ${SPLIT_IT}`
}

export const conversionErrorMessage = (status: number, code?: string): string =>
  (code ? BY_CODE[code] : undefined) ??
  BY_STATUS[status] ??
  'Something went wrong on our end. Try again in a moment.'

export const NETWORK_ERROR_MESSAGE =
  'Couldn’t reach the server. Check your connection and try again.'

/** Keeps the HTTP status, so a caller can branch on it instead of on the message text. */
export class ConversionError extends Error {
  readonly status: number

  constructor(status: number, code?: string) {
    super(conversionErrorMessage(status, code))
    this.name = 'ConversionError'
    this.status = status
  }
}
