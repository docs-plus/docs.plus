import { Plugin, PluginKey } from '@tiptap/pm/state'
import { TRANSACTION_META } from '@types'
import { logger } from '@utils/logger'

import {
  hasHierarchyViolations,
  transactionMayAffectHierarchy,
  validateAndFixHeadingHierarchy
} from '../validateHeadingHierarchy'

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
  // Run at least one full validation scan after plugin initialization.
  // This ensures legacy/invalid loaded docs are healed even if the first user edit
  // is a text-only change that would otherwise be skipped by fast-path heuristics.
  let hasRunInitialValidation = false

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

      // Fast path: plain text insertions cannot violate heading hierarchy.
      const canAffectHierarchy = transactions.some((tr) => transactionMayAffectHierarchy(tr))
      const shouldForceInitialValidation = !hasRunInitialValidation
      if (!canAffectHierarchy && !shouldForceInitialValidation) return null

      // Check if there are any violations
      const hasViolations = hasHierarchyViolations(newState.doc)
      hasRunInitialValidation = true
      if (!hasViolations) {
        return null
      }

      logger.warn('[HierarchyValidationPlugin] Found hierarchy violations, fixing...')

      const tr = newState.tr
      tr.setMeta('hierarchyValidationFix', true)
      tr.setMeta(TRANSACTION_META.ADD_TO_HISTORY, false)

      try {
        validateAndFixHeadingHierarchy(tr)
      } catch (error) {
        logger.error(
          '[HierarchyValidationPlugin] Fix threw — discarding fix transaction to prevent editor crash',
          error as Error
        )
        return null
      }

      if (tr.docChanged) {
        logger.info('[HierarchyValidationPlugin] Fixed hierarchy violations')
        return tr
      }

      return null
    }
  })
}

export default createHierarchyValidationPlugin
