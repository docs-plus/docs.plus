import { defineConfig } from 'tsup'

import { defineTiptapExtensionConfig } from '../../tsup.base'

// Reuses the shared extension factory. Listing `@tiptap/*` as external on a package
// that never imports them is a harmless no-op. The factory also keeps the production
// `pure: ['console.log', 'console.debug']` policy intact.
export default defineConfig(defineTiptapExtensionConfig())
