import { Plugin, PluginKey } from '@tiptap/pm/state'
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import { type Transaction, TRANSACTION_META } from '@types'
import { logger } from '@utils/logger'

import {
  hasHierarchyViolations,
  transactionMayAffectHierarchy,
  validateAndFixHeadingHierarchy
} from '../validateHeadingHierarchy'

const hierarchyValidationPluginKey = new PluginKey('hierarchyValidation')

/**
 * Extracts the affected position range from structural transactions,
 * mapped to the final document coordinates.
 *
 * Each step's positions are in the coordinate space of the document
 * at the point that step is applied. We use Mapping.slice(stepIndex)
 * to map through only the subsequent step maps within that transaction,
 * then through all later transactions — avoiding double-mapping.
 */
const getChangedRange = (
  transactions: readonly Transaction[]
): { from: number; to: number } | undefined => {
  let from = Infinity
  let to = -Infinity

  for (let i = 0; i < transactions.length; i++) {
    const tr = transactions[i]
    if (!tr.docChanged) continue

    tr.steps.forEach((step, stepIdx) => {
      if (!(step instanceof ReplaceStep || step instanceof ReplaceAroundStep)) return

      const toEndOfTr = tr.mapping.slice(stepIdx)
      let mappedFrom = toEndOfTr.map(step.from, -1)
      let mappedTo = toEndOfTr.map(step.to, 1)

      for (let j = i + 1; j < transactions.length; j++) {
        mappedFrom = transactions[j].mapping.map(mappedFrom, -1)
        mappedTo = transactions[j].mapping.map(mappedTo, 1)
      }

      from = Math.min(from, mappedFrom)
      to = Math.max(to, mappedTo)
    })
  }

  if (from === Infinity || to === -Infinity) return undefined
  return { from, to }
}

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

      // Scope the check to affected sections when possible
      const range = shouldForceInitialValidation ? undefined : getChangedRange(transactions)
      const hasViolations = hasHierarchyViolations(newState.doc, range?.from, range?.to)
      hasRunInitialValidation = true
      if (!hasViolations) return null

      logger.warn('[HierarchyValidationPlugin] Found hierarchy violations, fixing...')

      const tr = newState.tr
      tr.setMeta('hierarchyValidationFix', true)
      tr.setMeta(TRANSACTION_META.ADD_TO_HISTORY, false)

      try {
        validateAndFixHeadingHierarchy(tr, range?.from, range?.to)
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
