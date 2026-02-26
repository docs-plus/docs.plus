import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import { DecorationSet } from '@tiptap/pm/view'
import { type EditorState, type ProseMirrorNode, type Transaction } from '@types'

/**
 * Helper functions for optimizing ProseMirror decorations performance
 */

// Local type definitions using ProseMirror types
type BuildDecorationsFunction = (doc: ProseMirrorNode) => DecorationSet
type PluginStateApplyFunction = (tr: Transaction, old: DecorationSet) => DecorationSet

interface DecorationPluginState {
  init: (_: unknown, state: { doc: ProseMirrorNode }) => DecorationSet
  apply: PluginStateApplyFunction
}

interface DecorationPluginProps {
  decorations: (state: EditorState) => DecorationSet
}

/**
 * Creates an optimized apply function for decoration plugins
 * @param buildDecorationsFunc - Function that builds decorations from document
 * @param targetNodeTypes - Array of node type names to watch for changes
 * @returns Optimized apply function
 */
export function createOptimizedDecorationApply(
  buildDecorationsFunc: BuildDecorationsFunction,
  targetNodeTypes: string[]
): PluginStateApplyFunction {
  return function (tr: Transaction, old: DecorationSet): DecorationSet {
    if (!tr.docChanged) return old

    const mapped = old.map(tr.mapping, tr.doc)

    // Fast path: text-only changes (typing, backspace within text) cannot
    // add or remove structural nodes, so mapped decorations are always correct.
    // This avoids the expensive find() array comparison on every keystroke.
    const isTextOnly = tr.steps.every((step) => {
      if (step instanceof ReplaceAroundStep) return false
      if (!(step instanceof ReplaceStep)) return false
      const { slice } = step
      // Empty slice = deletion. Small range (< 8) means it's within inline
      // content (heading minimum nodeSize is ~8). Large range could span
      // structural boundaries and delete heading/contentWrapper nodes.
      if (slice.content.childCount === 0) return step.to - step.from < 8
      let textOnly = true
      slice.content.descendants((node: ProseMirrorNode) => {
        if (!node.isInline) {
          textOnly = false
          return false
        }
        return true
      })
      return textOnly
    })
    if (isTextOnly) return mapped

    // Structural change path: check if inserted content contains target nodes
    let needsRebuild = false
    tr.steps.forEach((step) => {
      if (needsRebuild) return
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) return
      const { slice } = step
      if (slice && slice.content) {
        slice.content.descendants((node: ProseMirrorNode) => {
          if (targetNodeTypes.includes(node.type.name)) {
            needsRebuild = true
            return false
          }
        })
      }
    })

    // Detect deleted target nodes: when a heading is removed, its decoration
    // is unmapped, reducing the count. Only runs for structural changes (rare).
    if (!needsRebuild) {
      const currentCount = mapped.find().length
      const originalCount = old.find().length
      needsRebuild = currentCount !== originalCount
    }

    return needsRebuild ? buildDecorationsFunc(tr.doc) : mapped
  }
}

/**
 * Creates a standard decoration plugin state configuration
 * @param buildDecorationsFunc - Function that builds decorations from document
 * @param targetNodeTypes - Array of node type names to watch for changes
 * @param initCallback - Optional callback to run during init
 * @returns Plugin state configuration
 */
export function createDecorationPluginState(
  buildDecorationsFunc: BuildDecorationsFunction,
  targetNodeTypes: string[],
  initCallback?: () => void
): DecorationPluginState {
  return {
    init(_, { doc }: { doc: ProseMirrorNode }): DecorationSet {
      if (initCallback) initCallback()
      return buildDecorationsFunc(doc)
    },
    apply: createOptimizedDecorationApply(buildDecorationsFunc, targetNodeTypes)
  }
}

/**
 * Creates standard decoration plugin props
 * @returns Plugin props configuration
 */
export function createDecorationPluginProps(): DecorationPluginProps {
  return {
    decorations(this: { getState: (state: EditorState) => DecorationSet }, state: EditorState) {
      return this.getState(state)
    }
  }
}
