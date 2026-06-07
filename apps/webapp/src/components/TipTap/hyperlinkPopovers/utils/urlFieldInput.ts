/** Non-global probe — safe to call repeatedly (unlike `/g`.test). */
const URL_FIELD_WS = /[\r\n\t]/

const URL_FIELD_WS_STRIP = /[\r\n\t]+/g

export function containsUrlFieldWhitespace(value: string): boolean {
  return URL_FIELD_WS.test(value)
}

export function stripUrlFieldWhitespace(value: string): string {
  return value.replace(URL_FIELD_WS_STRIP, '')
}

export type UrlFieldPasteResult = {
  value: string
  caret: number
}

export function urlFieldPasteValue(
  current: string,
  pasted: string,
  selectionStart: number | null,
  selectionEnd: number | null
): UrlFieldPasteResult | null {
  if (!containsUrlFieldWhitespace(pasted)) return null
  const { next, caret } = mergeUrlPaste(current, pasted, selectionStart, selectionEnd)
  return { value: next, caret }
}

export function mergeUrlPaste(
  current: string,
  pasted: string,
  selectionStart: number | null,
  selectionEnd: number | null
): { next: string; caret: number } {
  const cleaned = stripUrlFieldWhitespace(pasted).trim()
  const start = selectionStart ?? current.length
  const end = selectionEnd ?? start
  return {
    next: current.slice(0, start) + cleaned + current.slice(end),
    caret: start + cleaned.length
  }
}
