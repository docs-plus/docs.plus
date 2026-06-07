import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core'

import {
  captionAttribute,
  type CaptionHandle,
  createCaptionElement,
  readCaption
} from '../../caption'
import { wrapMediaWithLoadingShell } from '../../loading'
import { embedAttrsEqual } from '../../utils/embedKit'
import { ignoreNodeViewSubtreeMutation } from '../../utils/ignoreNodeViewMutation'
import {
  applyStyles,
  createStyleString,
  generateShortId,
  omitNullishAndFalse,
  type StyleLayoutOptions
} from '../../utils/utils'
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

export const Audio = Node.create<AudioOptions>({
  name: 'audio',
  draggable: true,

  addOptions() {
    return {
      src: null,
      controls: true,
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
        default: false
      },
      loop: {
        default: false
      },
      muted: {
        default: false
      },
      preload: {
        default: 'metadata' // Can be 'none', 'metadata', or 'auto'
      },
      volume: {
        default: 1.0
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
        default: null
      },
      height: {
        default: null
      },
      caption: captionAttribute()
    }
  },

  addNodeView() {
    const editor = this.editor

    return ({ node, HTMLAttributes, getPos }) => {
      const dom = document.createElement('div')
      const content = document.createElement('div')
      const audioTag = document.createElement('audio')

      dom.classList.add('hypermultimedia--audio__content')

      const styles = {
        display: node.attrs.display,
        height: parseInt(node.attrs.height),
        width: parseInt(node.attrs.width),
        float: node.attrs.float,
        clear: node.attrs.clear,
        margin: node.attrs.margin,
        justifyContent: node.attrs.justifyContent
      }

      applyStyles(dom, styles)

      const htmlAttributes = omitNullishAndFalse({
        src: node.attrs.src ?? HTMLAttributes.src,
        controls: node.attrs.controls,
        autoplay: node.attrs.autoplay,
        loop: node.attrs.loop,
        muted: node.attrs.muted,
        preload: node.attrs.preload,
        volume: node.attrs.volume
      })

      const attributes = mergeAttributes(htmlAttributes, {
        'data-node-name': this.name
      })

      Object.entries(attributes).forEach(
        ([key, value]) => value && audioTag.setAttribute(key, value)
      )

      content.append(audioTag)

      const shellWidth = parseInt(String(node.attrs.width), 10) || 450
      const shellHeight = parseInt(String(node.attrs.height), 10) || 120

      const { dom: loadingHost, controller } = wrapMediaWithLoadingShell(
        editor,
        { kind: 'audio', width: shellWidth, height: shellHeight },
        content,
        {
          bindLoad: {
            element: audioTag,
            isAlreadyReady: () => audioTag.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          }
        }
      )

      dom.append(loadingHost)

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

          if (!embedAttrsEqual(updatedNode.attrs, node.attrs, AUDIO_REMOUNT_ATTR_KEYS)) {
            return false
          }

          caption.sync(readCaption(updatedNode))
          return true
        }
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-audio] audio[src]'
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
      volume: node.attrs.volume
    })

    return [
      'div',
      { 'data-audio': '', class: 'hypermultimedia--audio__content', style },
      [
        'audio',
        mergeAttributes(htmlAttributes, { class: 'hypermultimedia--audio__content', style }),
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
      setAudio:
        (options) =>
        ({ commands }) => {
          if (!options.src) {
            throw new Error('Audio source is required')
          }

          return commands.insertContent({
            type: this.name,
            attrs: { ...options, keyId: generateShortId() }
          })
        }
    }
  }
})
