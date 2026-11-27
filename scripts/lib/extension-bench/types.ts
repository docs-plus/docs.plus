export const VARIANTS = ['base', 'head'] as const
export type Variant = (typeof VARIANTS)[number]

export type Size = { min: number; gz: number }

export type Bytes = {
  distEsm: Size
  starterKitApp: Size
  helperOnly: Size
}

export type Budget = {
  starterKitAppGz: number | null
  helperOnlyGz: number | null
}

export type ExtensionBenchConfig = {
  /** Absolute path to the extension package directory (containing package.json and tsup.config.ts). */
  packageRoot: string
  /** Published npm package name (e.g. `@docs.plus/extension-mermaid`). */
  extensionName: string
  /**
   * JS entry bundled against the extension's built `dist/index.js` (imported as `'EXT'`) to
   * measure incremental cost over a bare `@tiptap/core` + `@tiptap/starter-kit` editor.
   */
  starterKitEntry: string
  /** JS entry importing a standalone helper from `'EXT'` to measure tree-shaken helper cost. */
  helperEntry: string
  /** Display name for the helper-only table row (e.g. `'isSafeMediaSrc'`). */
  helperLabel: string
  /** Optional external module globs kept out of the StarterKit and helper bundles (e.g. lazy deps). */
  externalPackages?: string[]
}

type ResolveArgs = { path: string }

type EsbuildPlugin = {
  name: string
  setup: (build: {
    onResolve: (
      options: { filter: RegExp },
      callback: (args: ResolveArgs) => { path: string; external?: boolean }
    ) => void
  }) => void
}

export type Esbuild = {
  build: (options: Record<string, unknown> & { plugins?: EsbuildPlugin[] }) => Promise<{
    outputFiles: { contents: Uint8Array }[]
  }>
}
