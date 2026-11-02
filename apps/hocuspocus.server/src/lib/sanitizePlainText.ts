const WHITESPACE_RUN = /\s+/g

// Order matters. Whitespace collapses first so a newline becomes a word break,
// then the C0/C1 ranges go. Reversed, `a\nb` would strip to `ab`.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g

const clean = (value: string): string =>
  value.replace(WHITESPACE_RUN, ' ').replace(CONTROL_CHARS, '').trim()

/**
 * A caller may pass a whole pasted page, so the head goes first. The cleaned head is a prefix
 * of the cleaned whole, so when it already reaches `maxChars` the result is identical.
 */
export const sanitizePlainText = (value: string, maxChars: number): string => {
  const headLength = maxChars * 2 + 256
  const head = value.length > headLength ? clean(value.slice(0, headLength)) : null
  return (head !== null && head.length >= maxChars ? head : clean(value)).slice(0, maxChars)
}
