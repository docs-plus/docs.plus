import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'

import {
  captionAttribute,
  type CaptionHandle,
  createCaptionElement,
  readCaption
} from '../../caption'
import {
  layoutAttrsChanged,
  parseLayoutDimensions,
  syncVideoNodeLayout,
  wrapMediaWithLoadingShell
} from '../../loading'
import { embedAttrsEqual, resolveEmbedLayoutDimensions } from '../../utils/embedKit'
import { ignoreNodeViewSubtreeMutation } from '../../utils/ignoreNodeViewMutation'
import {
  createStyleString,
  generateShortId,
  omitNullishAndFalse,
  type StyleLayoutOptions
} from '../../utils/utils'
import { inputRegex } from './helper'

interface NodeOptions {
  HTMLAttributes: Record<string, unknown>
}

export interface VideoOptions extends StyleLayoutOptions, NodeOptions {
  // Node attributes
  inline?: boolean

  // Html attributes
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  poster?: string | null
  preload?: 'none' | 'metadata' | 'auto'
  src: string | null
}

export type SetVideoOptions = {
  src: string
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  poster?: string | null
  preload?: 'none' | 'metadata' | 'auto'
} & StyleLayoutOptions

/** `<video>` element attrs; remount the node view when any change. */
const VIDEO_REMOUNT_ATTR_KEYS = [
  'src',
  'controls',
  'autoplay',
  'loop',
  'muted',
  'preload',
  'poster'
] as const

export const Video = Node.create<VideoOptions>({
  name: 'video',
  draggable: true,

  addOptions() {
    return {
      src: null,
      margin: 'auto',
      clear: 'none',
      float: null,
      display: 'block',
      justifyContent: 'start',
      HTMLAttributes: {},
      inline: false,
      controls: true,
      height: 480,
      width: 640
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
      src: {
        default: null
      },
      controls: {
        default: this.options.controls
      },
      autoplay: {
        default: false
      },
      loop: {
        default: false
      },
      muted: {
        default: false
      },
      poster: {
        default: null
      },
      preload: {
        default: 'metadata'
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
      justifyContent: {
        default: this.options.justifyContent
      },
      width: {
        default: this.options.width
      },
      height: {
        default: this.options.height
      },
      caption: captionAttribute()
    }
  },

  addNodeView() {
    const editor = this.editor

    return ({ node, HTMLAttributes, getPos }) => {
      let attrsSnapshot = node.attrs
      const dom = document.createElement('div')
      const content = document.createElement('div')
      const videoTag = document.createElement('video') as HTMLVideoElement

      dom.classList.add('hypermultimedia--video__content')
      if (node.attrs.keyId) {
        dom.setAttribute('data-key-id', String(node.attrs.keyId))
      }

      const dims = parseLayoutDimensions(node.attrs)

      const htmlAttributes = omitNullishAndFalse({
        src: node.attrs.src ?? HTMLAttributes.src,
        controls: node.attrs.controls,
        autoplay: node.attrs.autoplay,
        loop: node.attrs.loop,
        muted: node.attrs.muted,
        preload: node.attrs.preload,
        poster: node.attrs.poster
      })

      Object.entries(mergeAttributes(htmlAttributes, { 'data-node-name': this.name })).forEach(
        ([key, value]) => {
          if (value !== undefined && value !== null && value !== false) {
            videoTag.setAttribute(key, String(value))
          }
        }
      )

      content.append(videoTag)

      const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
        editor,
        { kind: 'video', width: dims.width, height: dims.height },
        content,
        {
          bindLoad: {
            element: videoTag,
            isAlreadyReady: () => videoTag.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          }
        }
      )

      dom.append(loadingHost)
      syncVideoNodeLayout({
        wrapper: dom,
        attrs: node.attrs,
        loadingHost,
        video: videoTag,
        dims
      })

      const caption: CaptionHandle = createCaptionElement({
        editor,
        getPos,
        initial: readCaption(node)
      })
      dom.append(caption.el)

      return {
        dom,
        contentDOM: content,
        // Caption is a nested contenteditable the node view owns; keep PM out of its events.
        stopEvent: (event: Event) => caption.el.contains(event.target as globalThis.Node | null),
        destroy: () => {
          controller.destroy()
          caption.destroy()
        },
        ignoreMutation: (mutation) => ignoreNodeViewSubtreeMutation(mutation, dom),
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) return false

          if (layoutAttrsChanged(updatedNode.attrs, attrsSnapshot)) {
            syncVideoNodeLayout({
              wrapper: dom,
              attrs: updatedNode.attrs,
              loadingHost,
              video: videoTag
            })
          }

          if (!embedAttrsEqual(updatedNode.attrs, attrsSnapshot, VIDEO_REMOUNT_ATTR_KEYS)) {
            return false
          }

          caption.sync(readCaption(updatedNode))
          attrsSnapshot = updatedNode.attrs
          return true
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video] video[src]'
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    const style = createStyleString(this.options, {
      height: parseInt(HTMLAttributes.height),
      width: parseInt(HTMLAttributes.width),
      float: HTMLAttributes.float,
      clear: HTMLAttributes.clear,
      margin: HTMLAttributes.margin
    })

    const htmlAttributes = omitNullishAndFalse({
      src: node.attrs.src ?? HTMLAttributes.src,
      controls: node.attrs.controls,
      autoplay: node.attrs.autoplay,
      loop: node.attrs.loop,
      muted: node.attrs.muted,
      preload: node.attrs.preload,
      poster: node.attrs.poster
    })

    return [
      'div',
      { 'data-video': '', class: 'hypermultimedia--video__content', style },
      [
        'video',
        mergeAttributes(htmlAttributes, { class: 'hypermultimedia--video__content', style }),
        0
      ]
    ]
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: (match) => {
          const [, , src, width, height] = match

          return { src, width, height }
        }
      })
    ]
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          if (!options.src) {
            throw new Error('Video source is required')
          }

          const { width, height, ...rest } = options
          const layout = resolveEmbedLayoutDimensions(this.editor, { width, height }, this.options)

          return commands.insertContent({
            type: this.name,
            attrs: { ...rest, ...layout, keyId: generateShortId() }
          })
        }
    }
  }
})
