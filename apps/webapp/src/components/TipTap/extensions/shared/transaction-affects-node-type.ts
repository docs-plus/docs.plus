import type { Transaction } from '@tiptap/pm/state'
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'

/**
 * O(k) check — inspects only the changed ranges, not the whole document.
 *
 * Returns true when the transaction inserted or deleted nodes of the given type.
 * Use as a broader (but still cheap) fast path after `canMapDecorations` fails:
 *
 *   if (canMapDecorations(tr, ...)) return prev.map(...)   // strict O(1)
 *   if (!transactionAffectsNodeType(tr, 'heading')) return prev.map(...)  // broader O(k)
 *   return fullRebuild(...)   // rare: heading structure actually changed
 */
export function transactionAffectsNodeType(tr: Transaction, typeName: string): boolean {
  for (const step of tr.steps) {
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
      const clampedTo = Math.min(step.to, tr.before.content.size)
      if (step.from < clampedTo) {
        tr.before.nodesBetween(step.from, clampedTo, (node) => {
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
