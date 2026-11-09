import { Editor, mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Transaction } from '@tiptap/pm/state'

import {
  captionAttribute,
  mediaElementFrom,
  readCaption,
  wrapRenderWithCaption
} from '../../caption'
import { createImageMarkdownHooks } from '../../markdown/typedMediaMarkdown'
import { EMBED_LAYOUT_ATTR_KEYS } from '../../utils/embedKit'
import { fitLayoutToEditorColumn } from '../../utils/fitImageDimensions'
import { mediaLayoutCss } from '../../utils/layoutStyle'
import { keyIdAttribute } from '../../utils/media-node-attrs'
import { generateShortId } from '../../utils/utils'
import { inputRegex, isImageElementSrc } from './helper'
import { createImageNodeView } from './nodeView'
import { HyperImagePastePlugin } from './plugin'
import type { ImageOptions } from './types'

export const Image = Node.create<ImageOptions>({
  name: 'image',
  draggable: true,

  // Markdown round-trip lives on the node so a single
  // `HyperMultimediaKit.configure({ Image })` is the only entry a host needs.
  // Hooks are inert unless the host also loads @tiptap/markdown.
  ...createImageMarkdownHooks(EMBED_LAYOUT_ATTR_KEYS.filter((key) => key !== 'justifyContent')),

  addOptions() {
    return {
      allowBase64: false,
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

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      keyId: keyIdAttribute(),
      // A captioned image parses from its `<figure>`, so every layout attribute
      // has to read the inner `<img>` it was rendered onto. That is the same
      // reader `width`/`height`/`src` already use. Without that reader a wrapped
      // image comes back centred after a copy/paste.
      margin: {
        default: this.options.margin,
        parseHTML: (element) =>
          mediaElementFrom(element, 'img')?.getAttribute('margin') ?? this.options.margin
      },
      clear: {
        default: this.options.clear,
        parseHTML: (element) =>
          mediaElementFrom(element, 'img')?.getAttribute('clear') ?? this.options.clear
      },
      float: {
        default: this.options.float,
        parseHTML: (element) =>
          mediaElementFrom(element, 'img')?.getAttribute('float') ?? this.options.float
      },
      display: {
        default: this.options.display,
        parseHTML: (element) =>
          mediaElementFrom(element, 'img')?.getAttribute('display') ?? this.options.display
      },
      width: {
        default: this.options.width,
        parseHTML: (element) =>
          mediaElementFrom(element, 'img')?.getAttribute('width') || this.options.width,
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {})
      },
      height: {
        default: this.options.height,
        parseHTML: (element) =>
          mediaElementFrom(element, 'img')?.getAttribute('height') || this.options.height,
        renderHTML: (attributes) => (attributes.height ? { height: attributes.height } : {})
      },
      src: {
        default: null,
        parseHTML: (element) => mediaElementFrom(element, 'img')?.getAttribute('src') ?? null
      },
      alt: {
        default: null,
        parseHTML: (element) => mediaElementFrom(element, 'img')?.getAttribute('alt') ?? null
      },
      title: {
        default: null,
        parseHTML: (element) => mediaElementFrom(element, 'img')?.getAttribute('title') ?? null
      },
      caption: captionAttribute()
    }
  },

  parseHTML() {
    const acceptSrc = (src: string | null): boolean =>
      !!src && (this.options.allowBase64 || !src.startsWith('data:')) && isImageElementSrc(src)
    return [
      {
        tag: 'figure[data-hm-figure]',
        getAttrs: (element) => {
          const img = (element as HTMLElement).querySelector('img[src]')
          return acceptSrc(img?.getAttribute('src') ?? null) ? {} : false
        }
      },
      {
        tag: this.options.allowBase64 ? 'img[src]' : 'img[src]:not([src^="data:"])',
        getAttrs: (element) => (acceptSrc(element.getAttribute('src')) ? {} : false)
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const keyId = HTMLAttributes.keyId

    const width = HTMLAttributes.width ? parseInt(HTMLAttributes.width) : null
    const height = HTMLAttributes.height ? parseInt(HTMLAttributes.height) : null

    const { float, clear, margin } = HTMLAttributes
    const caption = readCaption(node)

    let imgStyle =
      'background-color: #f3f4f6; max-width: 100%; height: auto; box-sizing: border-box;'
    if (width && height) imgStyle += `width: ${width}px; aspect-ratio: ${width} / ${height}; `
    else if (width) imgStyle += `width: ${width}px; `

    const blockStyle = mediaLayoutCss({ float, clear, margin }, 'export-image-block')

    const img = [
      'img',
      mergeAttributes(this.options.HTMLAttributes, {
        ...HTMLAttributes,
        'data-key-id': keyId,
        class: 'hypermultimedia--image__content',
        style: (imgStyle + (caption ? '' : blockStyle)).trim()
      })
    ] as DOMOutputSpec
    return wrapRenderWithCaption(img, caption, blockStyle.trim())
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          if (!options.src) return false

          const keyId = generateShortId()
          let { width, height, ...rest } = options

          if (width && height) {
            const fitted = fitLayoutToEditorColumn(this.editor, width, height)
            width = fitted.width
            height = fitted.height
          }

          return commands.insertContent({
            type: this.name,
            attrs: { ...rest, width, height, keyId }
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
          // The scan runs even without dispatch so `editor.can()` reports a miss
          // instead of always answering true.
          let found = false
          tr.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.keyId === keyId) {
              found = true
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  width: width !== undefined ? width : node.attrs.width,
                  height: height !== undefined ? height : node.attrs.height
                })
              }
              return false
            }
          })
          return found
        }
    }
  },

  addNodeView() {
    return createImageNodeView(this.options, this.editor)
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
    return [
      HyperImagePastePlugin(editor, {
        nodeName: this.name,
        allowBase64: this.options.allowBase64
      })
    ]
  }
})
