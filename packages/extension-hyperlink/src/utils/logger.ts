// Internal logger — single greppable prefix for every package diagnostic.
// Only wraps `warn` / `error` because the shared tsup `pure` policy
// strips `console.log` / `console.debug` from production bundles.
const PREFIX = '[extension-hyperlink]'

export const logger = {
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
  error: (...args: unknown[]): void => console.error(PREFIX, ...args)
}
