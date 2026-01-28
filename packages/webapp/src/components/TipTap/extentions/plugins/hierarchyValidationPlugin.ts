import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TRANSACTION_META } from '@types'
import { validateAndFixHeadingHierarchy, hasHierarchyViolations } from '../validateHeadingHierarchy'

const hierarchyValidationPluginKey = new PluginKey('hierarchyValidation')

/**
 * ProseMirror plugin that automatically validates and fixes heading hierarchy
 * violations after each transaction.
 *
 * This ensures the document always follows HN-10 rules:
 * - H1 cannot be nested inside any heading
 * - Child level must be > parent level
 */
export const createHierarchyValidationPlugin = (): Plugin => {
  return new Plugin({
    key: hierarchyValidationPluginKey,

    appendTransaction(transactions, oldState, newState) {
      // Skip if no document changes
      const hasDocChanges = transactions.some((tr) => tr.docChanged)
      if (!hasDocChanges) return null

      // Skip if this is already a hierarchy fix transaction
      const isHierarchyFix = transactions.some(
        (tr) => tr.getMeta('hierarchyValidationFix') === true
      )
      if (isHierarchyFix) return null

      // Skip for certain meta flags that indicate internal operations
      const shouldSkip = transactions.some(
        (tr) =>
          tr.getMeta(TRANSACTION_META.ADD_TO_HISTORY) === false &&
          tr.getMeta(TRANSACTION_META.FOLD_AND_UNFOLD) === true
      )
      if (shouldSkip) return null

      // Check if there are any violations
      if (!hasHierarchyViolations(newState.doc)) {
        return null
      }

      console.warn('[HierarchyValidationPlugin] Found hierarchy violations, fixing...')

      // Create a new transaction to fix violations
      const tr = newState.tr
      tr.setMeta('hierarchyValidationFix', true)
      tr.setMeta(TRANSACTION_META.ADD_TO_HISTORY, false) // Don't add fix to history

      // Apply fixes
      validateAndFixHeadingHierarchy(tr)

      // Only return if changes were made
      if (tr.docChanged) {
        console.info('[HierarchyValidationPlugin] Fixed hierarchy violations')
        return tr
      }

      return null
    }
  })
}

export default createHierarchyValidationPlugin
