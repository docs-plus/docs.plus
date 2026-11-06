import type { Transaction } from '@tiptap/pm/state'
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'

/**
 * O(k) over changed ranges, not the whole doc. Cheap path after
 * `canMapDecorations` fails: map if this type was not inserted or deleted;
 * rebuild only when that type's structure actually changed.
 * Step i's positions refer to `tr.docs[i]`, not `tr.before`.
 */
export function transactionAffectsNodeType(tr: Transaction, typeName: string): boolean {
  for (let i = 0; i < tr.steps.length; i++) {
    const step = tr.steps[i]
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) {
      return true
    }

    const { slice } = step

    let found = false
    if (slice.content.childCount > 0) {
      slice.content.descendants((node) => {
        if (node.type.name === typeName) {
          found = true
          return false
        }
        return !found
      })
    }
    if (found) return true

    if (step.from < step.to) {
      const stepDoc = tr.docs[i]
      const clampedTo = Math.min(step.to, stepDoc.content.size)
      if (step.from < clampedTo) {
        stepDoc.nodesBetween(step.from, clampedTo, (node) => {
          if (node.type.name === typeName) {
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
