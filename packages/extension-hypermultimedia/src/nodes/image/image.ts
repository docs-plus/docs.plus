import type {
  JSONContent,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext
} from '@tiptap/core'
import { Editor, mergeAttributes, Node, nodeInputRule } from '@tiptap/core'
import type { DOMOutputSpec } from '@tiptap/pm/model'
import { Transaction } from '@tiptap/pm/state'

import {
  captionAttribute,
  mediaElementFrom,
  readCaption,
  wrapRenderWithCaption
} from '../../caption'
import type { ImageOptions } from '../../types'
import { fitLayoutToEditorColumn } from '../../utils/fitImageDimensions'
import { generateShortId } from '../../utils/utils'
import { inputRegex, isImageUrl } from './helper'
import { createImageNodeView } from './nodeView'
import { HyperImagePastePlugin } from './plugin'

export const Image = Node.create<ImageOptions>({
  name: 'image',
  draggable: true,

  // Markdown round-trip lives on the node so a single
  // `HyperMultimediaKit.configure({ Image })` is the only entry a host needs.
  // Hooks are inert unless the host also loads @tiptap/markdown.
  markdownTokenName: 'image',

  parseMarkdown: (token: MarkdownToken, _helpers: MarkdownParseHelpers) => ({
    type: 'image',
    attrs: { src: token.href || '', alt: token.text || '' }
  }),

  renderMarkdown: (node: JSONContent, _helpers: MarkdownRendererHelpers, _ctx: RenderContext) => {
    const alt = (node.attrs?.alt || '').replace(/\]/g, '\\]')
    const src = (node.attrs?.src || '').replace(/\)/g, '%29')
    return `![${alt}](${src})`
  },

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

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      keyId: {
        default: null
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
      !!src && (this.options.allowBase64 || !src.startsWith('data:')) && isImageUrl(src)
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

    let blockStyle = ''
    if (float && float !== 'unset') blockStyle += `float: ${float}; `
    if (clear && clear !== 'none') blockStyle += `clear: ${clear}; `
    if (margin && margin !== '0in') blockStyle += `margin: ${margin}; `

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
          if (dispatch) {
            tr.doc.descendants((node, pos) => {
              if (node.type.name === this.name && node.attrs.keyId === keyId) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  width: width !== undefined ? width : node.attrs.width,
                  height: height !== undefined ? height : node.attrs.height
                })
                return false
              }
            })
          }
          return true
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
    return [HyperImagePastePlugin(editor, { nodeName: this.name })]
  }
})
