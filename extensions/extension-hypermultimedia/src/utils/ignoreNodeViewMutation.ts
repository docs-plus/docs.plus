import type { ViewMutationRecord } from '@tiptap/pm/view'

/** Ignore PM reconciliation for DOM the node view owns (media load, oEmbed, widgets). */
export function ignoreNodeViewSubtreeMutation(
  mutation: ViewMutationRecord,
  root: HTMLElement
): boolean {
  const target = mutation.target
  return target instanceof globalThis.Node && root.contains(target)
}
