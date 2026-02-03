/**
 * Image Node with Storage Support
 *
 * Usage:
 * - editor.commands.setImage({ src: 'image.jpg', width: 300, height: 200 })
 * - editor.commands.updateImageDimensions({ keyId: 'img-123', width: 400, height: 300 })
 * - editor.commands.getImageDimensions({ keyId: 'img-123' })
 */
import { Editor, mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import { Transaction } from '@tiptap/pm/state'

import type { ImageOptions } from '../../types'
import { generateShortId } from '../../utils/utils'
import { inputRegex } from './helper'
import { HyperImagePastePlugin, HyperImagePlugin } from './plugin'

export const Image = Node.create<ImageOptions>({
  name: 'Image',
  draggable: true,
  priority: 1100,

  addOptions() {
    return {
      allowBase64: false,
      toolbar: undefined,
      margin: 'auto',
      clear: 'none',
      float: null,
      display: 'block',
      HTMLAttributes: {},
      inline: false,
      width: null,
      height: null
    }
  },

  addStorage() {
    return {
      imageDimensions: new Map<string, { width: number | null; height: number | null }>()
    }
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      keyId: {
        default: generateShortId()
      },
      margin: {
        default: this.options.margin
      },
      clear: {
        default: this.options.clear
      },
      float: {
        default: this.options.float
      },
      display: {
        default: this.options.display
      },
      transform: {
        default: 'rotate(0deg)'
      },
      width: {
        default: this.options.width,
        parseHTML: (element) => {
          const keyId = element.getAttribute('data-key-id')
          if (keyId && this.storage.imageDimensions.has(keyId)) {
            return this.storage.imageDimensions.get(keyId)?.width || this.options.width
          }
          return element.getAttribute('width') || this.options.width
        },
        renderHTML: (attributes) => {
          const keyId = attributes.keyId
          if (keyId && this.storage.imageDimensions.has(keyId)) {
            const stored = this.storage.imageDimensions.get(keyId)
            if (stored?.width) return { width: stored.width }
          }
          return attributes.width ? { width: attributes.width } : {}
        }
      },
      height: {
        default: this.options.height,
        parseHTML: (element) => {
          const keyId = element.getAttribute('data-key-id')
          if (keyId && this.storage.imageDimensions.has(keyId)) {
            return this.storage.imageDimensions.get(keyId)?.height || this.options.height
          }
          return element.getAttribute('height') || this.options.height
        },
        renderHTML: (attributes) => {
          const keyId = attributes.keyId
          if (keyId && this.storage.imageDimensions.has(keyId)) {
            const stored = this.storage.imageDimensions.get(keyId)
            if (stored?.height) return { height: stored.height }
          }
          return attributes.height ? { height: attributes.height } : {}
        }
      },
      src: {
        default: null
      },
      alt: {
        default: null
      },
      title: {
        default: null
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64 ? 'img[src]' : 'img[src]:not([src^="data:"])'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const keyId = HTMLAttributes.keyId

    // Get dimensions from storage if available
    let width = HTMLAttributes.width ? parseInt(HTMLAttributes.width) : null
    let height = HTMLAttributes.height ? parseInt(HTMLAttributes.height) : null

    if (keyId && this.storage.imageDimensions.has(keyId)) {
      const stored = this.storage.imageDimensions.get(keyId)
      width = stored?.width || width
      height = stored?.height || height
    }

    const float = HTMLAttributes.float
    const clear = HTMLAttributes.clear
    const margin = HTMLAttributes.margin

    // Build style string only with valid values
    let style = 'background-color: #f3f4f6;'
    if (width) style += `width: ${width}px; `
    if (height) style += `height: ${height}px; `
    if (float && float !== 'unset') style += `float: ${float}; `
    if (clear && clear !== 'none') style += `clear: ${clear}; `
    if (margin && margin !== '0in') style += `margin: ${margin}; `

    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        'data-key-id': keyId,
        class: 'hypermultimedia--image__content',
        style: style.trim()
      })
    ]
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          const keyId = generateShortId()

          // Save dimensions to storage if provided
          if (options.width || options.height) {
            this.storage.imageDimensions.set(keyId, {
              width: options.width || null,
              height: options.height || null
            })
          }

          return commands.insertContent({
            type: this.name,
            attrs: { ...options, keyId }
          })
        },

      updateImageDimensions:
        ({
          keyId,
          width,
          height
        }: {
          keyId: string
          width?: number | null
          height?: number | null
        }) =>
        ({ tr, dispatch }: { tr: Transaction; dispatch?: (tr: Transaction) => void }) => {
          if (dispatch) {
            // Update storage
            const existing = this.storage.imageDimensions.get(keyId) || {
              width: null,
              height: null
            }
            this.storage.imageDimensions.set(keyId, {
              width: width !== undefined ? width : existing.width,
              height: height !== undefined ? height : existing.height
            })

            // Find and update the node in the document
            tr.doc.descendants((node: any, pos: number) => {
              if (node.type.name === this.name && node.attrs.keyId === keyId) {
                const newAttrs = {
                  ...node.attrs,
                  width: width !== undefined ? width : node.attrs.width,
                  height: height !== undefined ? height : node.attrs.height
                }
                tr.setNodeMarkup(pos, undefined, newAttrs)
                return false // Stop searching
              }
            })
          }
          return true
        },

      getImageDimensions:
        ({ keyId }: { keyId: string }) =>
        () => {
          return this.storage.imageDimensions.get(keyId) || { width: null, height: null }
        }
    }
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , alt, src] = match

          return { src, alt }
        }
      })
    ]
  },

  addProseMirrorPlugins() {
    const editor = this.editor as Editor
    const toolbar = this.options.toolbar
    const nodeName = this.name
    return [
      HyperImagePlugin(editor, { nodeName, toolbar }),
      HyperImagePastePlugin(editor, { nodeName })
    ]
  }
})
