import type { Editor } from '@tiptap/core'
import { UniqueID, type UniqueIDOptions } from '@tiptap/extension-unique-id'
import {
  DOMSerializer,
  Fragment,
  type Node as ProseMirrorNode,
  type Schema,
  Slice
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

/** True only when an element of the parsed HTML carries this pad's mark, never mere text. */
export const hasPadMark = (html: string, padId: string): boolean => {
  if (typeof DOMParser === 'undefined') return false
  const dom = new DOMParser().parseFromString(html, 'text/html')
  // The whole fragment: ProseMirror wraps list and table slices, so the mark can sit deep.
  return dom.querySelector(`[${PAD_CLIPBOARD_ATTR}]`)?.getAttribute(PAD_CLIPBOARD_ATTR) === padId
}

/** The editor's pad id, which every writer reserves; `null` off a pad. */
export const padIdOf = (editor: Editor): string | null =>
  editor.extensionManager.extensions.find((e) => e.name === PadUniqueID.name)?.options.padId ?? null

// A drag slice reuses the doc's own node objects, which would read as untouched below.
const freshNodes = (fragment: Fragment): Fragment => {
  const list: ProseMirrorNode[] = []
  fragment.forEach((node) => list.push(node.isText ? node : node.copy(freshNodes(node.content))))
  return Fragment.from(list)
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
  attributeName: string,
  reserved: Iterable<string> = []
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

  const kept = keepPreferredIds(pasted, liveElsewhere, reserved)
  return pasted.filter((_, i) => kept[i] === null).map(({ pos }) => pos)
}

/**
 * Upstream UniqueID strips every pasted or dropped id. Heading chats and `?id=` links pair
 * by `toc-id`, so a paste or drag from this same pad keeps its ids (#700). A pasted id
 * that is taken, or equals the pad's documentId (the pad-wide chat), is replaced.
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
          return keep
            ? new Slice(freshNodes(slice.content), slice.openStart, slice.openEnd)
            : stripped
        }
      }
    })

    const samePadClipboard = new Plugin({
      key: new PluginKey('padClipboardIds'),
      props: {
        clipboardSerializer: new PadClipboardSerializer(this.editor.schema, padId),
        transformPastedHTML: (html) => {
          fromThisPad = hasPadMark(html, padId)
          return html
        },
        handleDOMEvents: {
          // An internal drop skips transformPastedHTML; an outside drop's HTML still sets it.
          drop: (view) => {
            fromThisPad = view.dragging != null
            return false
          }
        }
      },
      appendTransaction: (transactions, oldState, newState) => {
        if (!transactions.some(isPasteOrDrop)) return null
        // A peer's change is theirs to key; re-keying it here would fork the two clients.
        if (filterTransaction && transactions.some((tr) => !filterTransaction(tr))) return null

        const positions = pastedDuplicatePositions(
          oldState.doc,
          newState.doc,
          types,
          attributeName,
          [padId]
        )
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
