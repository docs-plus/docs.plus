import type { CompareDecorationsResult } from '@components/pages/history/types'
import { buildDiffTokenEncoder } from '@components/pages/history/utils/diffTokenEncoder'
// Never call ChangeSet.create with one argument: its default encoder ignores marks and
// attributes, so bold, a changed href and a heading level report zero changes. Rationale
// in apps/hocuspocus.server/docs/change-attribution.md.
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

  // Third argument, not a default: the library's own encoder keys a character on its
  // code and a node on its type name, so bold, a changed href and a heading level all
  // report zero changes. See diffTokenEncoder.ts.
  const set = ChangeSet.create(docA, undefined, buildDiffTokenEncoder()).addSteps(
    docB,
    [new StepMap([0, docA.content.size, docB.content.size])],
    [0]
  )
  const changes = simplifyChanges(set.changes, docB)

  const decorations: Decoration[] = []
  for (const change of changes) {
    if (change.toB > change.fromB) {
      const node = docB.nodeAt(change.fromB)
      // A node-start token spans one position, and an inline decoration over it paints
      // nothing. Attribute-only edits need the node arm. Checked before the text arm so
      // an image src change does not render as a formatting span.
      if (node && !node.isText && change.toB - change.fromB === 1) {
        decorations.push(
          Decoration.node(change.fromB, change.fromB + node.nodeSize, {
            class: 'history-diff-attr'
          })
        )
      } else {
        decorations.push(
          Decoration.inline(change.fromB, change.toB, { class: 'history-diff-added' })
        )
      }
    }
    if (change.toA > change.fromA) {
      // textBetween, not a serialized Slice: serializing needs DOMSerializer and can
      // nest block DOM inside an inline widget.
      const removed = docA.textBetween(change.fromA, change.toA, ' ', ' ')
      // An attribute-only edit changes a node-start token, so the A side reports a span
      // holding no text. An empty `del` says a word went when none did.
      if (!removed.trim()) continue
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
