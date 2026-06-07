import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { EditorState, Transaction } from '@tiptap/pm/state'
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

export function countTargetNodes(doc: ProseMirrorNode, targetNodeTypes: string[]): number {
  let count = 0
  doc.descendants((node) => {
    if (targetNodeTypes.includes(node.type.name)) count += 1
  })
  return count
}

export function targetNodeCountChanged(tr: Transaction, targetNodeTypes: string[]): boolean {
  if (!tr.docChanged) return false
  return countTargetNodes(tr.before, targetNodeTypes) !== countTargetNodes(tr.doc, targetNodeTypes)
}

export function transactionAffectsTargetDecorations(
  tr: Transaction,
  targetNodeTypes: string[]
): boolean {
  if (tr.getMeta(HIDE_RESIZE_GRIPPER_META) !== undefined) return true
  if (!tr.docChanged) return false
  return targetNodeCountChanged(tr, targetNodeTypes)
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
