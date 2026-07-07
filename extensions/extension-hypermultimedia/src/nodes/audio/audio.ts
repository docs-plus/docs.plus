import { Node, nodeInputRule } from '@tiptap/core'

import { captionAttribute } from '../../caption'
import { AUDIO_LAYOUT_FALLBACK } from '../../loading'
import { createTypedMediaMarkdownHooks } from '../../markdown/typedMediaMarkdown'
import { layoutAttrDefaults } from '../../utils/embedKit'
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

export interface AudioOptions extends StyleLayoutOptions, NodeOptions {
  // Node attributes
  inline?: boolean

  // Html attributes
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  volume?: number
  src: string | null
}

export type SetAudioOptions = {
  src: string
  controls?: boolean
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  preload?: 'none' | 'metadata' | 'auto'
  volume?: number
} & StyleLayoutOptions

/** `<audio>` element attrs; remount the node view when any change. */
const AUDIO_REMOUNT_ATTR_KEYS = [
  'src',
  'controls',
  'autoplay',
  'loop',
  'muted',
  'preload',
  'volume'
] as const

const AUDIO_MEDIA_CONFIG: HtmlMediaNodeConfig = {
  tag: 'audio',
  elementAttrKeys: AUDIO_REMOUNT_ATTR_KEYS,
  layoutFallback: AUDIO_LAYOUT_FALLBACK,
  isAlreadyReady: (media) => media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
}

export const Audio = Node.create<AudioOptions>({
  name: 'audio',
  draggable: true,

  ...createTypedMediaMarkdownHooks('audio', { withDimensions: true }),

  addOptions() {
    return {
      src: null,
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
      preload: 'metadata',
      volume: 1.0,
      margin: 'auto',
      clear: 'none',
      float: null,
      display: 'block',
      justifyContent: 'start',
      HTMLAttributes: {},
      inline: false
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
        default: this.options.autoplay
      },
      loop: {
        default: this.options.loop
      },
      muted: {
        default: this.options.muted
      },
      preload: {
        default: this.options.preload
      },
      volume: {
        default: this.options.volume
      },
      ...layoutAttrDefaults(this.options),
      // Audio options omit dims; persist explicit nulls, not `undefined` defaults.
      width: {
        default: null
      },
      height: {
        default: null
      },
      caption: captionAttribute()
    }
  },

  addNodeView() {
    return createHtmlMediaNodeView(AUDIO_MEDIA_CONFIG, () => ({
      name: this.name,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-audio] audio[src]'
      }
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderHtmlMediaHTML(AUDIO_MEDIA_CONFIG, this.options, { node, HTMLAttributes })
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
      setAudio:
        (options) =>
        ({ commands }) => {
          if (!options.src) return false

          return commands.insertContent({
            type: this.name,
            attrs: { ...options, keyId: generateShortId() }
          })
        }
    }
  }
})
