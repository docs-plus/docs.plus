import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

/** Matches brainstorm: body H1 visual cap and H4 fallback floor. */
const MAX_SIZE = 20
const MIN_SIZE = 12

export const headingScalePluginKey = new PluginKey<HeadingScaleState>('headingScale')

type HeadingScaleState = {
  fingerprint: string
  decorations: DecorationSet
}

type HeadingEntry = { pos: number; level: number; nodeSize: number }

function collectTopLevelHeadings(doc: PMNode): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      headings.push({
        pos: offset,
        level: node.attrs.level as number,
        nodeSize: node.nodeSize
      })
    }
  })
  return headings
}

/** Structural fingerprint: heading levels in document order (top-level blocks only). */
function computeHeadingFingerprint(doc: PMNode): string {
  return collectTopLevelHeadings(doc)
    .map((h) => h.level)
    .join(',')
}

function buildDecorations(doc: PMNode): DecorationSet {
  const headings = collectTopLevelHeadings(doc)
  if (headings.length === 0) return DecorationSet.empty

  const sections: HeadingEntry[][] = []
  let current: HeadingEntry[] = []

  for (const h of headings) {
    if (h.level === 1 && current.length > 0) {
      sections.push(current)
      current = []
    }
    current.push(h)
  }
  if (current.length > 0) sections.push(current)

  const decorations: Decoration[] = []

  for (const section of sections) {
    const distinct = [...new Set(section.map((h) => h.level))].sort((a, b) => a - b)
    const totalRanks = distinct.length

    for (const h of section) {
      const rank = distinct.indexOf(h.level)
      const size =
        totalRanks === 1 ? MAX_SIZE : MAX_SIZE - (rank * (MAX_SIZE - MIN_SIZE)) / (totalRanks - 1)
      const rank1 = rank + 1
      const pt = Number(size.toFixed(2))

      decorations.push(
        Decoration.node(h.pos, h.pos + h.nodeSize, {
          style: `--hd-size: ${pt}pt; --hd-rank: ${rank1}; --hd-total: ${totalRanks}`
        })
      )
    }
  }

  return DecorationSet.create(doc, decorations)
}

export const HeadingScale = Extension.create({
  name: 'headingScale',

  addProseMirrorPlugins() {
    return [
      new Plugin<HeadingScaleState>({
        key: headingScalePluginKey,

        state: {
          init(_, state) {
            const doc = state.doc
            return {
              fingerprint: computeHeadingFingerprint(doc),
              decorations: buildDecorations(doc)
            }
          },

          apply(tr, prev, _oldState, newState) {
            if (!tr.docChanged) return prev

            const doc = newState.doc

            if (tr.getMeta('y-sync$')) {
              return {
                fingerprint: computeHeadingFingerprint(doc),
                decorations: buildDecorations(doc)
              }
            }

            const newFp = computeHeadingFingerprint(doc)
            if (newFp === prev.fingerprint) {
              return {
                fingerprint: prev.fingerprint,
                decorations: prev.decorations.map(tr.mapping, doc)
              }
            }

            return {
              fingerprint: newFp,
              decorations: buildDecorations(doc)
            }
          }
        },

        props: {
          decorations(state) {
            return headingScalePluginKey.getState(state)?.decorations ?? DecorationSet.empty
          }
        }
      })
    ]
  }
})
