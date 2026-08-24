const isDev = process.env.NODE_ENV === 'development'

export function logError(message: string, error?: unknown): void {
  if (isDev) {
    console.error(message, error)
  }
}
