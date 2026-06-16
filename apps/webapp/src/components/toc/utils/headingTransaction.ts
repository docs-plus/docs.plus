import { headingFoldPluginKey } from '@components/TipTap/extensions/heading-fold'
import type { Transaction } from '@tiptap/pm/state'
import { ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform'
import { TIPTAP_EVENTS, TIPTAP_NODES, TRANSACTION_META } from '@types'

function isPositionInHeading(doc: Transaction['doc'], pos: number): boolean {
  if (doc.content.size === 0) return false

  const clamped = Math.max(1, Math.min(pos, doc.content.size))
  try {
    const $pos = doc.resolve(clamped)
    for (let depth = $pos.depth; depth >= 0; depth--) {
      if ($pos.node(depth).type.name === TIPTAP_NODES.HEADING_TYPE) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

function replaceStepTouchesHeading(
  tr: Transaction,
  step: ReplaceStep | ReplaceAroundStep
): boolean {
  const stepMap = step.getMap()
  const mappedFrom = stepMap.map(step.from, -1)
  const mappedTo = stepMap.map(step.to, 1)

  return (
    isPositionInHeading(tr.before, step.from) ||
    isPositionInHeading(tr.before, step.to) ||
    isPositionInHeading(tr.doc, mappedFrom) ||
    isPositionInHeading(tr.doc, mappedTo)
  )
}

function replaceStepInsertsOrDeletesHeading(
  tr: Transaction,
  step: ReplaceStep | ReplaceAroundStep
): boolean {
  const typeName = TIPTAP_NODES.HEADING_TYPE
  const { slice } = step

  if (slice.content.childCount > 0) {
    let found = false
    slice.content.descendants((node) => {
      if (node.type.name === typeName) {
        found = true
        return false
      }
      return !found
    })
    if (found) return true
  }

  if (step.from < step.to) {
    const clampedTo = Math.min(step.to, tr.before.content.size)
    if (step.from < clampedTo) {
      let found = false
      tr.before.nodesBetween(step.from, clampedTo, (node) => {
        if (node.type.name === typeName) {
          found = true
          return false
        }
      })
      if (found) return true
    }
  }

  return false
}

/** True when the transaction should rebuild the flat TOC list (text, structure, or explicit meta). */
export function transactionRequiresTocRebuild(tr: Transaction): boolean {
  if (tr.getMeta(headingFoldPluginKey)) return false

  if (tr.getMeta(TRANSACTION_META.RENDER_TOC) || tr.getMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED)) {
    return true
  }

  if (!tr.docChanged) return false

  for (const step of tr.steps) {
    if (!(step instanceof ReplaceStep) && !(step instanceof ReplaceAroundStep)) continue

    if (replaceStepTouchesHeading(tr, step)) return true
    if (replaceStepInsertsOrDeletesHeading(tr, step)) return true
  }

  return false
}
