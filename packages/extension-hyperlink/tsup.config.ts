import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'tsup'

import { defineTiptapExtensionConfig } from '../../tsup.base'

export default defineConfig(
  defineTiptapExtensionConfig({
    async onSuccess() {
      copyFileSync(resolve('src/styles.css'), resolve('dist/styles.css'))
    }
  })
)
