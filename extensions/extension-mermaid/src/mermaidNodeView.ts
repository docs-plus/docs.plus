import type { Editor, NodeViewRendererProps } from '@tiptap/core'
import type { NodeView } from '@tiptap/pm/view'

import { createMermaidView } from './nodeView/createMermaidNodeView'
import { createFolds } from './nodeView/fold'
import type { MermaidOptions, MermaidStorage } from './types'

/**
 * Draws `mermaid` blocks inside your own `codeBlock` `addNodeView`, and returns `null` for other blocks.
 * Call it in `addNodeView`, with `Mermaid` in the same editor: `return (props) => mermaid(props) ?? own(props)`.
 */
export function mermaidNodeView(editor: Editor): (props: NodeViewRendererProps) => NodeView | null {
  const extension = editor.extensionManager.extensions.find((e) => e.name === 'mermaid')
  if (!extension)
    throw new Error(
      '[extension-mermaid] mermaidNodeView needs the Mermaid extension in the same editor.'
    )
  const options = extension.options as MermaidOptions
  const storage = (editor.storage as unknown as Record<string, MermaidStorage>).mermaid
  storage.factoryUsed = true
  storage.folds ??= createFolds(options)
  const build = createMermaidView(editor, options, storage.folds)
  return ({ node, getPos }) => build(node, getPos)
}
