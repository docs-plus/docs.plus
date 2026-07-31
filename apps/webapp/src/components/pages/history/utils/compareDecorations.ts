import type { CompareDecorationsResult } from '@components/pages/history/types'
import { ChangeSet, simplifyChanges } from '@tiptap/pm/changeset'
import type { Node as PMNode, Schema } from '@tiptap/pm/model'
import { StepMap } from '@tiptap/pm/transform'
import { Decoration } from '@tiptap/pm/view'

/**
 * Diffs two version documents into decorations for the read-only history editor.
 * No `.check()`: the title-first doc node rejects empty and paragraph-first legacy
 * rows that `nodeFromJSON` and the changeset both handle fine.
 */
export function buildCompareDecorations(
  schema: Schema,
  jsonA: unknown,
  jsonB: unknown
): CompareDecorationsResult {
  let docA: PMNode
  let docB: PMNode
  try {
    docA = schema.nodeFromJSON(jsonA)
    docB = schema.nodeFromJSON(jsonB)
  } catch {
    return { error: 'undecodable' }
  }

  const set = ChangeSet.create(docA).addSteps(
    docB,
    [new StepMap([0, docA.content.size, docB.content.size])],
    [0]
  )
  const changes = simplifyChanges(set.changes, docB)

  const decorations: Decoration[] = []
  for (const change of changes) {
    if (change.toB > change.fromB) {
      decorations.push(Decoration.inline(change.fromB, change.toB, { class: 'history-diff-added' }))
    }
    if (change.toA > change.fromA) {
      // textBetween, not a serialized Slice: serializing needs DOMSerializer and can
      // nest block DOM inside an inline widget.
      const removed = docA.textBetween(change.fromA, change.toA, ' ', ' ')
      decorations.push(
        Decoration.widget(
          change.fromB,
          () => {
            const el = document.createElement('del')
            el.className = 'history-diff-removed'
            el.textContent = removed
            return el
          },
          { side: -1 }
        )
      )
    }
  }

  return { decorations }
}
