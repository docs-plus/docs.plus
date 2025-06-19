import { Transaction, EditorState } from '@tiptap/pm/state'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { DecorationSet } from '@tiptap/pm/view'

/**
 * Helper functions for optimizing ProseMirror decorations performance
 */

export type BuildDecorationsFunction = (doc: ProseMirrorNode) => DecorationSet

export type PluginStateApplyFunction = (tr: Transaction, old: DecorationSet) => DecorationSet

export interface DecorationPluginState {
  init: (config: any, instance: { doc: ProseMirrorNode }) => DecorationSet
  apply: PluginStateApplyFunction
}

export interface DecorationPluginProps {
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

    // Map existing decorations to new document positions
    const mapped = old.map(tr.mapping, tr.doc)
    let needsRebuild = false

    // Only rebuild if target nodes were structurally changed
    tr.steps.forEach((step) => {
      const stepWithSlice = step as any
      if (stepWithSlice.jsonID === 'replace' || stepWithSlice.jsonID === 'replaceAround') {
        const slice = stepWithSlice.slice
        if (slice && slice.content) {
          // Check if the slice contains target node types
          slice.content.descendants((node: ProseMirrorNode) => {
            if (targetNodeTypes.includes(node.type.name)) {
              needsRebuild = true
              return false // Stop iteration
            }
          })
        }
      }
    })

    // Check if any decorations were unmapped (node was deleted)
    if (!needsRebuild) {
      const currentDecorations = mapped.find()
      const originalDecorations = old.find()
      needsRebuild = currentDecorations.length !== originalDecorations.length
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
    decorations(state: EditorState): DecorationSet {
      return (this as any).getState(state)
    }
  }
}
