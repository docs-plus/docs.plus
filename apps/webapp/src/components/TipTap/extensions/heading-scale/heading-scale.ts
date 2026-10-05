import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// #369: the 14pt floor keeps the smallest heading about 1.17x the 12pt body text.
const MAX_SIZE = 24
const MIN_SIZE = 14

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

function computeHeadingFingerprint(doc: PMNode): string {
  return collectTopLevelHeadings(doc)
    .map((h) => h.level)
    .join(',')
}

function buildDecorations(doc: PMNode): DecorationSet {
  const all = collectTopLevelHeadings(doc)
  // CSS draws the Title (`> h1:first-child`) at a fixed 28pt, so it takes no rank.
  const headings = all[0]?.pos === 0 && all[0].level === 1 ? all.slice(1) : all
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
            const fingerprint = computeHeadingFingerprint(doc)

            if (fingerprint === prev.fingerprint) {
              // A step that replaces a heading's tokens (setNodeMarkup, moveSection, split, paste)
              // drops its node decoration instead of moving it. A Yjs change replaces the whole
              // document, so it always drops. Rebuild when anything drops.
              let dropped = false
              const decorations = prev.decorations.map(tr.mapping, doc, {
                onRemove: () => {
                  dropped = true
                }
              })
              if (!dropped) return { fingerprint, decorations }
            }

            return { fingerprint, decorations: buildDecorations(doc) }
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
