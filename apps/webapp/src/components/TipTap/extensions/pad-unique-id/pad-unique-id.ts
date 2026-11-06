import { UniqueID, type UniqueIDOptions } from '@tiptap/extension-unique-id'
import {
  DOMSerializer,
  type Fragment,
  type Node as ProseMirrorNode,
  type Schema
} from '@tiptap/pm/model'
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state'

import { keepPreferredIds } from '../shared/keep-preferred-ids'

/** Stamped on the first element of copied HTML, so a paste can tell it came from this pad. */
export const PAD_CLIPBOARD_ATTR = 'data-docsplus-pad'

export interface PadUniqueIDOptions extends UniqueIDOptions {
  /** The open pad's documentId. Without it every paste takes new ids, as upstream does. */
  padId: string | null
}

class PadClipboardSerializer extends DOMSerializer {
  constructor(
    schema: Schema,
    private readonly padId: string
  ) {
    const base = DOMSerializer.fromSchema(schema)
    super(base.nodes, base.marks)
  }

  serializeFragment(
    fragment: Fragment,
    options: { document?: Document } = {},
    target?: HTMLElement | DocumentFragment
  ): HTMLElement | DocumentFragment {
    const dom = super.serializeFragment(fragment, options, target)
    // Node content calls back in with a `target`; only the clipboard's top-level call has none.
    const first = target ? null : dom.firstChild
    if (first?.nodeType === 1) (first as Element).setAttribute(PAD_CLIPBOARD_ATTR, this.padId)
    return dom
  }
}

const isPasteOrDrop = (tr: Transaction): boolean => {
  const event = tr.getMeta('uiEvent')
  return event === 'paste' || event === 'drop'
}

/**
 * Positions of pasted nodes that must take a new id. A node the paste left untouched is
 * the same object in both docs; it keeps its id, so a paste cannot move another
 * heading's chat. The pasted nodes share what is left through `keepPreferredIds`.
 */
export const pastedDuplicatePositions = (
  before: ProseMirrorNode,
  after: ProseMirrorNode,
  types: readonly string[],
  attributeName: string
): number[] => {
  const untouched = new Set<ProseMirrorNode>()
  before.descendants((node) => {
    if (types.includes(node.type.name)) untouched.add(node)
  })

  const liveElsewhere = new Set<string>()
  const pasted: { pos: number; preferredId: string }[] = []
  after.descendants((node, pos) => {
    const id = node.attrs[attributeName]
    if (!types.includes(node.type.name) || typeof id !== 'string' || id === '') return
    if (untouched.has(node)) liveElsewhere.add(id)
    else pasted.push({ pos, preferredId: id })
  })

  const kept = keepPreferredIds(pasted, liveElsewhere)
  return pasted.filter((_, i) => kept[i] === null).map(({ pos }) => pos)
}

/**
 * Upstream UniqueID strips every pasted id. Heading chats and `?id=` links pair by
 * `toc-id`, so a paste from this same pad keeps its ids (#700). An id that then
 * appears twice goes to the pasted copy, which takes a new one.
 */
export const PadUniqueID = UniqueID.extend<PadUniqueIDOptions>({
  addOptions() {
    return { ...this.parent!(), padId: null }
  },

  addProseMirrorPlugins() {
    const plugins = this.parent?.() ?? []
    const { padId, attributeName, generateID, filterTransaction } = this.options
    const types = Array.isArray(this.options.types) ? this.options.types : []
    const [uniqueId, ...rest] = plugins
    const stripIds = uniqueId?.spec.props?.transformPasted
    if (!padId || !uniqueId || !stripIds) return plugins

    let fromThisPad = false

    const keepSamePadIds = new Plugin({
      ...uniqueId.spec,
      props: {
        ...uniqueId.spec.props,
        transformPasted: (slice, view, plain) => {
          // Always call upstream: it resets its own paste flag.
          const stripped = stripIds.call(uniqueId, slice, view, plain)
          const keep = fromThisPad
          fromThisPad = false
          return keep ? slice : stripped
        }
      }
    })

    const samePadClipboard = new Plugin({
      key: new PluginKey('padClipboardIds'),
      props: {
        clipboardSerializer: new PadClipboardSerializer(this.editor.schema, padId),
        transformPastedHTML: (html) => {
          fromThisPad = html.includes(`${PAD_CLIPBOARD_ATTR}="${padId}"`)
          return html
        }
      },
      appendTransaction: (transactions, oldState, newState) => {
        if (!transactions.some(isPasteOrDrop)) return null
        // A peer's change is theirs to key; re-keying it here would fork the two clients.
        if (filterTransaction && transactions.some((tr) => !filterTransaction(tr))) return null

        const positions = pastedDuplicatePositions(oldState.doc, newState.doc, types, attributeName)
        if (positions.length === 0) return null

        const { tr } = newState
        for (const pos of positions) {
          const node = tr.doc.nodeAt(pos)
          if (!node) continue
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            [attributeName]: generateID({ node, pos })
          })
        }
        return tr.setStoredMarks(newState.storedMarks)
      }
    })

    return [keepSamePadIds, samePadClipboard, ...rest]
  }
})
