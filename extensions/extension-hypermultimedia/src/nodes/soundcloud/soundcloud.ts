import { Node, nodePasteRule } from '@tiptap/core'

import { captionAttribute } from '../../caption'
import { createTypedMediaMarkdownHooks } from '../../markdown/typedMediaMarkdown'
import {
  EMBED_BLOCK_LAYOUT_DEFAULTS,
  type EmbedNodeOptions,
  kitAttrDefaults,
  layoutAttrDefaults
} from '../../utils/embedKit'
import {
  createIframeEmbedNodeView,
  type IframeEmbedConfig,
  renderIframeEmbedHTML
} from '../../utils/iframeEmbedNode'
import { generateShortId, type StyleLayoutOptions } from '../../utils/utils'
import {
  buildSoundCloudEmbedUrl,
  fitSoundCloudLayoutToEditorColumn,
  parseSoundCloudTrackUrl,
  resolveSoundCloudIframeAttributes,
  SOUNDCLOUD_EMBED_ATTR_KEYS,
  SOUNDCLOUD_PLAYER_KIT_DEFAULTS,
  type SoundCloudPlayerKitOptions,
  syncSoundCloudResponsiveHost
} from './embedOptions'
import { isValidSoundCloudUrl, SOUNDCLOUD_URL_REGEX_GLOBAL } from './helper'

export interface SoundCloudOptions
  extends StyleLayoutOptions, EmbedNodeOptions, SoundCloudPlayerKitOptions {}

export type SetSoundCloudOptions = {
  src: string
} & StyleLayoutOptions &
  Partial<SoundCloudPlayerKitOptions>

const SOUNDCLOUD_IFRAME_CONFIG: IframeEmbedConfig<SoundCloudOptions> = {
  wrapperClass: 'hypermultimedia--soundcloud__content',
  dataVideoAttr: 'data-soundcloud-video',
  renderWrapperClass: 'soundcloud-video',
  embedAttrKeys: SOUNDCLOUD_EMBED_ATTR_KEYS,
  loadingProvider: 'SoundCloud',
  buildEmbedUrl: buildSoundCloudEmbedUrl,
  resolveIframeAttributes: resolveSoundCloudIframeAttributes,
  syncLoadingHost: syncSoundCloudResponsiveHost
}

export const SoundCloud = Node.create<SoundCloudOptions>({
  name: 'soundcloud',
  draggable: true,

  ...createTypedMediaMarkdownHooks('soundcloud'),

  addOptions() {
    return {
      ...SOUNDCLOUD_PLAYER_KIT_DEFAULTS,
      ...EMBED_BLOCK_LAYOUT_DEFAULTS,
      width: 450,
      height: 120
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
      keyId: { default: null },
      src: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('src')
          if (!raw) return null
          const track = parseSoundCloudTrackUrl(raw) ?? raw
          return isValidSoundCloudUrl(track) ? track : null
        }
      },
      caption: captionAttribute(),
      ...layoutAttrDefaults(this.options),
      ...kitAttrDefaults(this.options, SOUNDCLOUD_PLAYER_KIT_DEFAULTS)
    }
  },

  addNodeView() {
    return createIframeEmbedNodeView(SOUNDCLOUD_IFRAME_CONFIG, () => ({
      name: this.name,
      options: this.options,
      editor: this.editor
    }))
  },

  parseHTML() {
    return [{ tag: 'div[data-soundcloud-video] iframe' }]
  },

  addCommands() {
    return {
      setSoundCloud:
        (options: SetSoundCloudOptions) =>
        ({ commands }) => {
          if (!isValidSoundCloudUrl(options.src)) return false

          const { width, height, ...rest } = options
          const layout = fitSoundCloudLayoutToEditorColumn(
            this.editor,
            Number(width ?? this.options.width),
            Number(height ?? this.options.height),
            rest,
            this.options
          )

          return commands.insertContent({
            type: this.name,
            attrs: { ...rest, ...layout, keyId: generateShortId() }
          })
        }
    }
  },

  renderHTML({ node, HTMLAttributes }) {
    return renderIframeEmbedHTML(SOUNDCLOUD_IFRAME_CONFIG, this.options, { node, HTMLAttributes })
  },

  addPasteRules() {
    if (!this.options.addPasteHandler) return []

    return [
      nodePasteRule({
        find: SOUNDCLOUD_URL_REGEX_GLOBAL,
        type: this.type,
        getAttributes: (match) => {
          const src = match.input?.trim()
          if (!src || !isValidSoundCloudUrl(src)) return false
          const layout = fitSoundCloudLayoutToEditorColumn(
            this.editor,
            Number(this.options.width),
            Number(this.options.height),
            { src },
            this.options
          )
          return { src, ...layout }
        }
      })
    ]
  }
})
