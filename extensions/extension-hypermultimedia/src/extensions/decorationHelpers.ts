import { Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorState, Transaction } from '@tiptap/pm/state'
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import { DecorationSet } from '@tiptap/pm/view'

export const HIDE_RESIZE_GRIPPER_META = 'hideResizeGripper'

export type BuildDecorationsFunction = (doc: ProseMirrorNode) => DecorationSet

export type PluginStateApplyFunction = (tr: Transaction, old: DecorationSet) => DecorationSet

export interface DecorationPluginState {
  init: (config: any, instance: { doc: ProseMirrorNode }) => DecorationSet
  apply: PluginStateApplyFunction
}

export interface DecorationPluginProps {
  decorations: (state: EditorState) => DecorationSet
}

export function shouldHideResizeGripper(tr: Transaction): boolean {
  return tr.getMeta(HIDE_RESIZE_GRIPPER_META) === true
}

function fragmentHasTrackedType(fragment: Fragment, targetNodeTypes: string[]): boolean {
  let found = false
  fragment.descendants((node) => {
    if (found) return false
    if (targetNodeTypes.includes(node.type.name)) found = true
    return !found
  })
  return found
}

function rangeHasTrackedType(
  doc: ProseMirrorNode,
  from: number,
  to: number,
  targetNodeTypes: string[]
): boolean {
  if (from >= to) return false
  let found = false
  doc.nodesBetween(from, to, (node) => {
    if (found) return false
    if (targetNodeTypes.includes(node.type.name)) found = true
    return !found
  })
  return found
}

/**
 * O(k) replacement for a whole-doc count diff: a tracked node added, removed, or
 * replaced shows up in some step's changed range or inserted slice. Scans each
 * step against its own before-doc (`tr.docs[i]`); mark/attr steps can't change
 * node structure, so they're skipped.
 */
export function transactionAffectsTrackedNodes(
  tr: Transaction,
  targetNodeTypes: string[]
): boolean {
  if (!tr.docChanged) return false
  for (let i = 0; i < tr.steps.length; i++) {
    const step = tr.steps[i]
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) continue
    if (fragmentHasTrackedType(step.slice.content, targetNodeTypes)) return true
    // tr.docs[i] is the doc before step i (PM keeps docs.length === steps.length),
    // so step.from/to are in its coordinate space — never tr.before's.
    if (rangeHasTrackedType(tr.docs[i], step.from, step.to, targetNodeTypes)) return true
  }
  return false
}

export function transactionAffectsTargetDecorations(
  tr: Transaction,
  targetNodeTypes: string[]
): boolean {
  if (tr.getMeta(HIDE_RESIZE_GRIPPER_META) !== undefined) return true
  return transactionAffectsTrackedNodes(tr, targetNodeTypes)
}

/** Rebuilds when target media nodes are added/removed or gripper visibility meta changes; otherwise maps. */
export function createOptimizedDecorationApply(
  buildDecorationsFunc: BuildDecorationsFunction,
  targetNodeTypes: string[]
): PluginStateApplyFunction {
  return function (tr: Transaction, old: DecorationSet): DecorationSet {
    if (transactionAffectsTargetDecorations(tr, targetNodeTypes)) {
      return buildDecorationsFunc(tr.doc)
    }
    return tr.docChanged ? old.map(tr.mapping, tr.doc) : old
  }
}

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

export function createDecorationPluginProps(): DecorationPluginProps {
  return {
    decorations(state: EditorState): DecorationSet {
      return (this as any).getState(state)
    }
  }
}
