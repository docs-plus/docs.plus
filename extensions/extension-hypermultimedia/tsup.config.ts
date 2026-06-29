import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

import { defineTiptapExtensionConfig } from '../../tsup.base'

// Per-file copies for webapp globals.scss; bundled styles.css for npm + playground.
// Keep file list in sync with apps/webapp/src/styles/globals.scss (hypermultimedia @import block).
const STYLE_FILES = [
  'resize-gripper.css',
  'media-loading-shell.css',
  'media-node-x.css',
  'media-node-loom.css',
  'media-node-spotify.css',
  'media-toolbar.css'
]

export default defineConfig(
  defineTiptapExtensionConfig({
    external: ['@tiptap/core', '@tiptap/pm'],
    async onSuccess() {
      const distDir = resolve('dist')
      const stylesDir = resolve('src/styles')
      const bundled = STYLE_FILES.map((file) => {
        const src = resolve(stylesDir, file)
        copyFileSync(src, resolve(distDir, file))
        return readFileSync(src, 'utf8')
      }).join('\n')
      writeFileSync(resolve(distDir, 'styles.css'), bundled)
    }
  })
)
