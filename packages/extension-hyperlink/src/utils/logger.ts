/**
 * Tiny internal logger so every diagnostic from this package is greppable
 * with one prefix. Kept module-internal — not re-exported from the
 * package barrel — because consumers shouldn't depend on our log shape.
 *
 * Only `warn` / `error` are wrapped: `console.log` / `console.debug` are
 * stripped from the production bundle by the shared tsup `pure` policy
 * (see `tsup.base.ts`), so wrapping them here would create the illusion
 * of debug logging in prod builds.
 */
const PREFIX = '[extension-hyperlink]'

export const logger = {
  warn: (...args: unknown[]): void => console.warn(PREFIX, ...args),
  error: (...args: unknown[]): void => console.error(PREFIX, ...args)
}
