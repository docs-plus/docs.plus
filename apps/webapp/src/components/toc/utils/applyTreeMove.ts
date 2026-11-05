import { moveSection } from '@components/TipTap/extensions/shared'
import type { Editor } from '@tiptap/core'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'
import type { EditorState, Transaction } from '@tiptap/pm/state'
import { StepMap } from '@tiptap/pm/transform'
import type { TocTreeMovePlan } from '@types'
import { TIPTAP_EVENTS, TIPTAP_NODES } from '@types'

import { clampHeadingLevel } from './planTreeMove'

function shiftLevels(content: Fragment, d: number): Fragment {
  if (d === 0) return content
  const nodes: PMNode[] = []
  content.forEach((node) => {
    nodes.push(
      node.type.name === TIPTAP_NODES.HEADING_TYPE
        ? node.type.create(
            { ...node.attrs, level: clampHeadingLevel((node.attrs.level as number) + d) },
            node.content,
            node.marks
          )
        : node
    )
  })
  return Fragment.from(nodes)
}

/** Pure: the plan must come from `state.doc`. A caret inside the set rides with it (#520). */
export function treeMoveTransaction(state: EditorState, plan: TocTreeMovePlan): Transaction {
  const { doc, selection } = state
  const { from, to } = plan
  const tr = state.tr
  const landedFrom = moveSection(
    tr,
    from,
    to,
    plan.insertPos,
    shiftLevels(doc.slice(from, to).content, plan.d)
  )

  if (selection.from >= from && selection.to <= to) {
    // A level change keeps every node size, so offsets inside the set are exact.
    tr.setSelection(selection.map(tr.doc, StepMap.offset(landedFrom - from)))
  }
  return tr.setMeta(TIPTAP_EVENTS.NEW_HEADING_CREATED, true)
}

export function applyTreeMove(editor: Editor, plan: TocTreeMovePlan): void {
  editor.view.dispatch(treeMoveTransaction(editor.state, plan))
}
