/** The word an empty heading shows: the editor placeholder tail and the TOC row. */
export const emptyHeadingLabel = (level: number): string => `Heading ${level}`

/** A heading's name: its trimmed text, or `Heading N` when the text is blank. */
export const headingLabel = ({ text, level }: { text: string; level: number }): string =>
  text.trim() || emptyHeadingLabel(level)
