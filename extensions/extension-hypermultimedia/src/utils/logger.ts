// Production logger kept (not stripped): sanitize/render failures must stay
// visible in the field, and `console.error` survives the tsup `pure` policy.
export class Logger {
  static error(message: string, error?: unknown): void {
    console.error(`[HyperMultimedia] ${message}`, error)
  }
}
