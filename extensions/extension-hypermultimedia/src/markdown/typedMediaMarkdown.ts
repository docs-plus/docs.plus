import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext
} from '@tiptap/core'

import { isValidLoomUrl } from '../nodes/loom/helper'
import { isValidSoundCloudUrl } from '../nodes/soundcloud/helper'
import { isValidSpotifyUrl } from '../nodes/spotify/helper'
import { isValidVimeoUrl } from '../nodes/vimeo/helper'
import { isValidXUrl } from '../nodes/x/helper'
import { isValidYoutubeUrl } from '../nodes/youtube/helper'
import { isAudioUrl, isVideoUrl } from '../utils/mediaUrl'

/** Reserved `![alt]` literals routed to non-image media nodes. */
export const TYPED_MEDIA_MARKDOWN_ALTS = [
  'audio',
  'video',
  'youtube',
  'vimeo',
  'soundcloud',
  'spotify',
  'loom',
  'x'
] as const

export type TypedMediaMarkdownAlt = (typeof TYPED_MEDIA_MARKDOWN_ALTS)[number]

export function isTypedMediaMarkdownAlt(alt: string): alt is TypedMediaMarkdownAlt {
  return (TYPED_MEDIA_MARKDOWN_ALTS as readonly string[]).includes(alt)
}

// Gate routing on the src so `![x](photo.png)` — an image whose alt collides with a
// reserved literal — stays an image instead of round-tripping into a broken embed.
export const TYPED_MEDIA_SRC_VALIDATORS: Record<TypedMediaMarkdownAlt, (url: string) => boolean> = {
  audio: isAudioUrl,
  video: isVideoUrl,
  youtube: isValidYoutubeUrl,
  vimeo: isValidVimeoUrl,
  soundcloud: isValidSoundCloudUrl,
  spotify: isValidSpotifyUrl,
  loom: isValidLoomUrl,
  x: isValidXUrl
}

type TypedMediaMarkdownOptions = {
  withDimensions?: boolean
}

type TypedMediaMarkdownHooks = {
  markdownTokenName: string
  markdownTokenizer: {
    name: string
    level: 'inline'
    start: (src: string) => number
    tokenize: (
      src: string,
      tokens: MarkdownToken[],
      lexer: MarkdownLexerConfiguration
    ) => MarkdownToken | undefined
  }
  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => JSONContent
  renderMarkdown: (
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    ctx: RenderContext
  ) => string
}

/** `![{nodeName}](src)` import/export hooks shared by every non-image media node. */
export function createTypedMediaMarkdownHooks(
  nodeName: TypedMediaMarkdownAlt,
  options: TypedMediaMarkdownOptions = {}
): TypedMediaMarkdownHooks {
  const tokenName = `hm_${nodeName}`
  const dimPattern = options.withDimensions
    ? String.raw`(?:\s+width=(\d+))?(?:\s+height=(\d+))?`
    : ''
  const pattern = new RegExp(String.raw`^!\[${nodeName}\]\((\S+)${dimPattern}\)`)

  return {
    markdownTokenName: tokenName,

    markdownTokenizer: {
      name: tokenName,
      level: 'inline' as const,
      start: (src: string) => src.indexOf(`![${nodeName}]`),
      tokenize: (src: string, _tokens: MarkdownToken[], _lexer: MarkdownLexerConfiguration) => {
        const match = pattern.exec(src)
        if (!match) return undefined
        if (!TYPED_MEDIA_SRC_VALIDATORS[nodeName](match[1])) return undefined

        return {
          type: tokenName,
          raw: match[0],
          href: match[1],
          ...(options.withDimensions && { width: match[2], height: match[3] })
        }
      }
    },

    parseMarkdown: (token: MarkdownToken, _helpers: MarkdownParseHelpers) => {
      const attrs: Record<string, unknown> = { src: token.href || '' }
      if (options.withDimensions) {
        if (token.width) attrs.width = Number(token.width)
        if (token.height) attrs.height = Number(token.height)
      }
      return { type: nodeName, attrs }
    },

    renderMarkdown: (node: JSONContent, _helpers: MarkdownRendererHelpers, _ctx: RenderContext) => {
      const src = (node.attrs?.src || '').replace(/\)/g, '%29')
      if (!options.withDimensions) {
        return `![${nodeName}](${src})`
      }

      const width = node.attrs?.width
      const height = node.attrs?.height
      let out = `![${nodeName}](${src}`
      if (width != null && width !== '') out += ` width=${width}`
      if (height != null && height !== '') out += ` height=${height}`
      return `${out})`
    }
  }
}
