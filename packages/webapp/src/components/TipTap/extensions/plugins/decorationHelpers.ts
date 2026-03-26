import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import { DecorationSet } from '@tiptap/pm/view'
import { type EditorState, type ProseMirrorNode, type Transaction } from '@types'

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
 * O(k) check on the changed range — did the transaction insert or delete
 * any nodes of the target types?  Replaces the previous O(N) approach that
 * called `DecorationSet.find().length` (which allocates the full decoration
 * array just to count it).
 */
function transactionAffectsTargetNodes(tr: Transaction, targetNodeTypes: string[]): boolean {
  for (const step of tr.steps) {
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) return true

    const { slice } = step
    let found = false

    if (slice?.content.childCount) {
      slice.content.descendants((node: ProseMirrorNode) => {
        if (targetNodeTypes.includes(node.type.name)) {
          found = true
          return false
        }
        return !found
      })
    }
    if (found) return true

    if (step.from < step.to) {
      const clampedTo = Math.min(step.to, tr.before.content.size)
      if (step.from < clampedTo) {
        tr.before.nodesBetween(step.from, clampedTo, (node: ProseMirrorNode) => {
          if (targetNodeTypes.includes(node.type.name)) {
            found = true
            return false
          }
        })
      }
    }
    if (found) return true
  }

  return false
}

export function createOptimizedDecorationApply(
  buildDecorationsFunc: BuildDecorationsFunction,
  targetNodeTypes: string[]
): PluginStateApplyFunction {
  return function (tr: Transaction, old: DecorationSet): DecorationSet {
    if (!tr.docChanged) return old

    const mapped = old.map(tr.mapping, tr.doc)

    // Fast path: text-only changes (typing, backspace within text) cannot
    // add or remove structural nodes, so mapped decorations are always correct.
    const isTextOnly = tr.steps.every((step) => {
      if (step instanceof ReplaceAroundStep) return false
      if (!(step instanceof ReplaceStep)) return false
      const { slice } = step
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

    // Structural change: O(k) check on changed ranges only — no full doc traversal.
    return transactionAffectsTargetNodes(tr, targetNodeTypes)
      ? buildDecorationsFunc(tr.doc)
      : mapped
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
