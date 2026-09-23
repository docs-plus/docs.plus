export const canShareFiles = (files: File[]): boolean =>
  typeof navigator.share === 'function' &&
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files })

/** A closed share sheet or save picker rejects with `AbortError`; that is a cancel, not a failure. */
export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError'
