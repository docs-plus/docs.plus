import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

import { defineTiptapExtensionConfig } from '../../tsup.base'

// Bundled dist/styles.css for npm + playground. Keep STYLE_FILES in sync with
// apps/webapp/src/styles/editor-extensions.scss (hypermultimedia @import block).
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
      const stylesDir = resolve('src/styles')
      const bundled = STYLE_FILES.map((file) =>
        readFileSync(resolve(stylesDir, file), 'utf8')
      ).join('\n')
      writeFileSync(resolve('dist', 'styles.css'), bundled)
    }
  })
)
