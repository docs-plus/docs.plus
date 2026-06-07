import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

import { defineTiptapExtensionConfig } from '../../tsup.base'

export default defineConfig(
  defineTiptapExtensionConfig({
    external: ['@tiptap/core', '@tiptap/pm', '@docs.plus/floating-popover'],
    async onSuccess() {
      copyFileSync(resolve('src/styles/resize-gripper.css'), resolve('dist/resize-gripper.css'))
      copyFileSync(
        resolve('src/styles/media-loading-shell.css'),
        resolve('dist/media-loading-shell.css')
      )
      copyFileSync(resolve('src/styles/media-toolbar.css'), resolve('dist/media-toolbar.css'))
    }
  })
)
