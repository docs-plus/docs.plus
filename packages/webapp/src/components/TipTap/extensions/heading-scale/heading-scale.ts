import { Extension } from '@tiptap/core'
import type { Node as PMNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

import { canMapDecorations, transactionAffectsNodeType } from '../shared'

const MAX_SIZE = 20
const MIN_SIZE = 12

export const headingScalePluginKey = new PluginKey<DecorationSet>('headingScale')

type HeadingEntry = { pos: number; level: number; nodeSize: number }

function buildDecorations(doc: PMNode): DecorationSet {
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

      decorations.push(
        Decoration.node(h.pos, h.pos + h.nodeSize, {
          style: `--hd-size: ${Number(size.toFixed(2))}pt`
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
      new Plugin<DecorationSet>({
        key: headingScalePluginKey,

        state: {
          init(_, state) {
            return buildDecorations(state.doc)
          },

          apply(tr, prev, oldState, newState) {
            if (!tr.docChanged) return prev
            if (tr.getMeta('y-sync$')) return buildDecorations(newState.doc)
            if (canMapDecorations(tr, oldState.doc)) {
              return prev.map(tr.mapping, newState.doc)
            }
            if (!transactionAffectsNodeType(tr, 'heading')) {
              return prev.map(tr.mapping, newState.doc)
            }
            return buildDecorations(newState.doc)
          }
        },

        props: {
          decorations(state) {
            return headingScalePluginKey.getState(state) ?? DecorationSet.empty
          }
        }
      })
    ]
  }
})
