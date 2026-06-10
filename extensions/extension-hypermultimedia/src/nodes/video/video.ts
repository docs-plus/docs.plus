import { Node, nodeInputRule } from '@tiptap/core'

import { captionAttribute } from '../../caption'
import { layoutAttrDefaults, resolveEmbedLayoutDimensions } from '../../utils/embedKit'
import {
  createHtmlMediaNodeView,
  type HtmlMediaNodeConfig,
  renderHtmlMediaHTML
} from '../../utils/htmlMediaNode'
import { generateShortId, type StyleLayoutOptions } from '../../utils/utils'
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

const VIDEO_MEDIA_CONFIG: HtmlMediaNodeConfig = {
  tag: 'video',
  elementAttrKeys: VIDEO_REMOUNT_ATTR_KEYS,
  isAlreadyReady: (media) => media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
}

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
      ...layoutAttrDefaults(this.options),
      caption: captionAttribute()
    }
  },

  addNodeView() {
    return createHtmlMediaNodeView(VIDEO_MEDIA_CONFIG, () => ({
      name: this.name,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video] video[src]'
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderHtmlMediaHTML(VIDEO_MEDIA_CONFIG, this.options, { node, HTMLAttributes })
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
          if (!options.src) return false

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
