import { Fragment, Slice } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Editor } from '@tiptap/react'
import { TIPTAP_NODES } from '@types'

import clipboardPaste from '../clipboardPaste'
import deleteSelectedRange from '../deleteSelectedRange'
import { getSelectionBlocks } from '../helper'

const SCHEMA_PRESERVED_DIV_TYPES: ReadonlySet<string> = new Set([
  TIPTAP_NODES.HEADING_TYPE,
  TIPTAP_NODES.CONTENT_WRAPPER_TYPE
])

const legacyHeadingClass = TIPTAP_NODES.HEADING_TYPE

const fallbackNormalizeDivTags = (html: string) => html.replace(/<(\/?)div(\s|>|\/)/gi, '<$1span$2')

/**
 * Normalizes pasted HTML while preserving schema-critical wrapper nodes.
 *
 * We preserve heading/contentWrapper divs emitted by docs.plus schema so
 * round-trip copy/paste can keep structural hints. Generic div tags are
 * converted to span to avoid schema-confusing container wrappers from
 * external sources.
 */
export const normalizePastedHtml = (html: string): string => {
  if (!html || !/<\/?div[\s>]/i.test(html)) return html

  if (typeof DOMParser === 'undefined') {
    return fallbackNormalizeDivTags(html)
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const divElements = Array.from(doc.querySelectorAll('div'))

    divElements.forEach((divElement) => {
      const dataType = divElement.getAttribute('data-type')
      const className = divElement.getAttribute('class') || ''
      const classNames = className.split(/\s+/).filter(Boolean)

      const isSchemaDiv =
        (dataType && SCHEMA_PRESERVED_DIV_TYPES.has(dataType)) ||
        classNames.includes(legacyHeadingClass)

      if (isSchemaDiv) return

      const spanElement = doc.createElement('span')
      Array.from(divElement.attributes).forEach((attr) => {
        spanElement.setAttribute(attr.name, attr.value)
      })

      while (divElement.firstChild) {
        spanElement.appendChild(divElement.firstChild)
      }

      divElement.replaceWith(spanElement)
    })

    return doc.body.innerHTML
  } catch {
    return fallbackNormalizeDivTags(html)
  }
}

/**
 * Creates a plugin for handling copy and paste operations with custom transformations
 * @param editor - The TipTap editor instance
 * @returns ProseMirror plugin
 */
export function createCopyPastePlugin(editor: Editor): Plugin {
  let domEvent: 'copy' | 'cut' = 'copy'

  return new Plugin({
    key: new PluginKey('copy&pasteHeading'),
    props: {
      handleDOMEvents: {
        cut: () => {
          domEvent = 'cut'
          return false
        },
        copy: () => {
          domEvent = 'copy'
          return false
        }
      },
      // Preserve schema-critical wrappers while normalizing noisy external div containers.
      transformPastedHTML: (html: string) => normalizePastedHtml(html),
      transformPasted: (slice: Slice) => clipboardPaste(slice, editor),
      transformCopied: () => {
        // Can be used to transform copied or cut content before it is serialized to the clipboard.
        const { selection, doc } = editor.state
        const { from, to } = selection

        const cutDoc = doc.cut(from, to)
        const contentWrapper = getSelectionBlocks(cutDoc, 0, cutDoc.content.size, true, false)

        if (domEvent === 'cut') {
          // remove selection from the editor
          deleteSelectedRange(editor)
        }

        // Reset to default so a stale "cut" state never leaks to future copies.
        domEvent = 'copy'

        // convert Json Block to Node Block
        const serializedSelection = contentWrapper.map((x) => editor.state.schema.nodeFromJSON(x))

        // convert Node Block to Fragment
        const fragmentArray = Fragment.fromArray(serializedSelection)

        // convert Fragment to Slice and save it to clipboard
        return Slice.maxOpen(fragmentArray)
      }
    }
  })
}
