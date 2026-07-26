/**
 * The conversion API's own error strings name byte limits and field names, which
 * is right for an API client and wrong for a person. One table, both endpoints.
 */
const BY_STATUS: Record<number, string> = {
  401: 'Your session has expired. Reload the page and sign in again.',
  403: 'You don’t have access to this document.',
  404: 'This document no longer exists. Reload the page.',
  413: 'That file is too big. Word files are capped at 10 MB, Markdown at 64,000 characters.',
  415: 'Old .doc files aren’t supported. Open it in Word, save it as .docx, and try again.',
  422: 'That file couldn’t be read. It may be damaged, or not a Word or Markdown file.'
}

export const conversionErrorMessage = (status: number): string =>
  BY_STATUS[status] ?? 'Something went wrong on our end. Try again in a moment.'

export const NETWORK_ERROR_MESSAGE =
  'Couldn’t reach the server. Check your connection and try again.'
