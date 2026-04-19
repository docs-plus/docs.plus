/**
 * Narrow ambient types for the Bun playground server.
 *
 * The playground lives outside the package `tsconfig.json` `include`
 * scope (which is `src/**`), so it doesn't need a separate tsconfig or
 * `@types/bun` devDep. This file gives the IDE's tsserver enough to
 * understand the two Bun APIs we actually use — `Bun.serve` and the
 * `import './index.html'` HTML entrypoint — without pulling in the
 * full Bun ambient namespace.
 */

declare const Bun: {
  serve(options: {
    port?: number
    hostname?: string
    routes?: Record<string, unknown>
    development?: boolean
  }): { url: URL; stop(): void }
}

declare module '*.html' {
  const html: unknown
  export default html
}
