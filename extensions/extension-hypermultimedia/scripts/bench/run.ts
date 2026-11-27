/**
 * HyperMultimedia byte bench: dist ESM, StarterKit app cost, and helper-only import against a git
 * ref or npm tarball (#784).
 * Usage: NODE_ENV=production bun scripts/bench/run.ts [--ref main] [--bytes-only]
 *   [--budget scripts/bench/bytes-budget.json] [--save file.json]
 */
import { join } from 'node:path'

import { runExtensionBench } from '../../../../scripts/lib/extension-bench/run'

const SK = "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';"

await runExtensionBench({
  packageRoot: join(import.meta.dir, '../..'),
  extensionName: '@docs.plus/extension-hypermultimedia',
  starterKitEntry: `${SK}import {HyperMultimediaKit} from 'EXT';new Editor({extensions:[StarterKit,HyperMultimediaKit.configure()]})`,
  helperEntry: "import {isSafeMediaSrc} from 'EXT';console.log(isSafeMediaSrc)",
  helperLabel: 'isSafeMediaSrc'
})
