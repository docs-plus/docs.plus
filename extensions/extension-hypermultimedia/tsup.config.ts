import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

import { defineTiptapExtensionConfig } from '../../tsup.base'

// Webapp imports these individually via globals.scss; keep them in dist and also
// concatenate a single ./styles.css export so npm consumers and the clean-room
// playground load the shipped artifact the way extension-hyperlink does.
const STYLE_FILES = ['resize-gripper.css', 'media-loading-shell.css', 'media-toolbar.css']

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
