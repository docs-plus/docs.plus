/**
 * Mermaid byte bench: dist ESM, StarterKit app cost (eager entry with `pele/*` external), and
 * helper-only import against a git ref or npm tarball (#784).
 * Usage: NODE_ENV=production bun scripts/bench/run.ts [--ref main] [--bytes-only]
 *   [--budget scripts/bench/bytes-budget.json] [--save file.json]
 */
import { join } from 'node:path'

import { runExtensionBench } from '../../../../scripts/lib/extension-bench/run'

const SK = "import {Editor} from '@tiptap/core';import StarterKit from '@tiptap/starter-kit';"

await runExtensionBench({
  packageRoot: join(import.meta.dir, '../..'),
  extensionName: '@docs.plus/extension-mermaid',
  starterKitEntry: `${SK}import {Mermaid} from 'EXT';new Editor({extensions:[StarterKit,Mermaid.configure()]})`,
  helperEntry: "import {mermaidNodeView} from 'EXT';console.log(mermaidNodeView)",
  helperLabel: 'mermaidNodeView',
  // pele/lazy and its diagram chunks load on demand at render time; keep them external so
  // this budget tracks the eager extension entry cost rather than upstream diagram grammars.
  externalPackages: ['pele', 'pele/*']
})
