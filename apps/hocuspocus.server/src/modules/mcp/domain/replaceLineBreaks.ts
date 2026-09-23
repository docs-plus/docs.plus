// Every line terminator a reader may break on, not only CR and LF.
const LINE_BREAKS = /\r\n|[\n\v\f\r\u0085\u2028\u2029]/g

/** Stranger-written text must not start a new line of its own inside a tool's text. */
export const replaceLineBreaks = (text: string, replacement: string): string =>
  text.replace(LINE_BREAKS, replacement)
