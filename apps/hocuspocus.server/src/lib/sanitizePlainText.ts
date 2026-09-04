const WHITESPACE_RUN = /\s+/g

// Order matters. Whitespace collapses first so a newline becomes a word break,
// then the C0/C1 ranges go. Reversed, `a\nb` would strip to `ab`.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g

export const sanitizePlainText = (value: string, maxChars: number): string =>
  value.replace(WHITESPACE_RUN, ' ').replace(CONTROL_CHARS, '').trim().slice(0, maxChars)
