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
import { X_EMBED_THEMES } from '../nodes/x/embedOptions'
import { isValidXUrl } from '../nodes/x/helper'
import { isValidYoutubeUrl } from '../nodes/youtube/helper'
import { EMBED_LAYOUT_ATTR_KEYS } from '../utils/embedKit'
import { MEDIA_PRELOAD_VALUES } from '../utils/htmlMediaNode'
import { isAudioUrl, isSafeMediaSrc, isVideoUrl } from '../utils/mediaUrl'

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

// The alt is user text, so a plain lookup would find `toString` on the prototype.
const isTypedMediaAlt = (alt: string): alt is TypedMediaMarkdownAlt =>
  (TYPED_MEDIA_MARKDOWN_ALTS as readonly string[]).includes(alt)

// Gate routing on the src. Then `![x](photo.png)`, an image whose alt collides
// with a reserved literal, stays an image instead of round-tripping into a
// broken embed.
const TYPED_MEDIA_SRC_VALIDATORS: Record<TypedMediaMarkdownAlt, (url: string) => boolean> = {
  audio: isAudioUrl,
  video: isVideoUrl,
  youtube: isValidYoutubeUrl,
  vimeo: isValidVimeoUrl,
  soundcloud: isValidSoundCloudUrl,
  spotify: isValidSpotifyUrl,
  loom: isValidLoomUrl,
  x: isValidXUrl
}

const LENGTH = String.raw`(?:auto|0|\d*\.?\d+(?:px|in|em|rem|%|pt|cm|mm))`
const MARGIN_RE = new RegExp(String.raw`^${LENGTH}(?:\s+${LENGTH}){0,3}$`)

const oneOf =
  (...values: readonly string[]) =>
  (raw: string): string | undefined =>
    values.includes(raw) ? raw : undefined

const positiveNumber = (raw: string): number | undefined => {
  const match = /^(\d{1,5}(?:\.\d+)?)(?:px)?$/.exec(raw)
  const value = match ? Number(match[1]) : 0
  return value > 0 ? value : undefined
}

const boolean = (raw: string): boolean | undefined =>
  raw === 'true' ? true : raw === 'false' ? false : undefined

// Values land in inline `style` and player attributes, and collab attrs are never
// re-validated. So both import and export run every value through this allowlist.
// The key order here is the order export writes.
const OPTION_VALUES = {
  width: positiveNumber,
  height: positiveNumber,
  maxwidth: positiveNumber,
  display: oneOf('block', 'inline', 'inline-block', 'flex', 'inline-flex'),
  // The toolbar writes `none` where the schema default is null. Both mean "not floated".
  float: (raw) => (raw === 'none' ? null : oneOf('left', 'right')(raw)),
  clear: oneOf('none', 'left', 'right', 'both'),
  margin: (raw) => (MARGIN_RE.test(raw) ? raw : undefined),
  justifyContent: oneOf('start', 'center', 'end', 'flex-start', 'flex-end', 'left', 'right'),
  controls: boolean,
  autoplay: boolean,
  loop: boolean,
  muted: boolean,
  preload: oneOf(...MEDIA_PRELOAD_VALUES),
  poster: (raw) => (isSafeMediaSrc(raw) ? raw : undefined),
  theme: oneOf(...X_EMBED_THEMES),
  lang: (raw) => (/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/.test(raw) ? raw : undefined),
  hide_media: boolean,
  hide_thread: boolean
} satisfies Record<string, (raw: string) => unknown>

type MarkdownOptionKey = keyof typeof OPTION_VALUES

type MarkdownOptionValues = Partial<Record<MarkdownOptionKey, unknown>>

const OPTION_KEYS = Object.keys(OPTION_VALUES) as MarkdownOptionKey[]

const isOptionKey = (name: string): name is MarkdownOptionKey =>
  (OPTION_KEYS as readonly string[]).includes(name)

/** Markdown names that differ from the attribute name. Import reads both. */
const OPTION_NAMES: Partial<Record<MarkdownOptionKey, string>> = {
  justifyContent: 'justify-content'
}

const KEY_FOR_NAME = new Map(Object.entries(OPTION_NAMES).map(([key, name]) => [name, key]))

// CommonMark allows one level of balanced parentheses in a link destination.
const DESTINATION = String.raw`(?<src>[^\s()]+(?:\([^\s()]*\)[^\s()]*)*)`
const TITLE = String.raw`(?:\s+(?<title>"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'))?`
// The old in-parenthesis size form, kept on import only. It reads like an option block.
const LEGACY_SIZE = String.raw`(?<legacy>(?:\s+width=\d+)?(?:\s+height=\d+)?)`
const OPTION_BLOCK = String.raw`\{(?<block>(?:[^}"'\n]|"[^"\n]*"|'[^'\n]*')*)\}`
const OPTION_RE = /([A-Za-z][\w-]*)=(?:"([^"\n]*)"|'([^'\n]*)'|([^\s"'}]+))/g
const ESCAPED_PUNCTUATION_RE = /\\([!-/:-@[-`{-~])/g

// Both parentheses, so an unbalanced one in a URL cannot end the destination early.
const encodeDestination = (src: unknown): string =>
  String(src ?? '')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')

const unescapeMarkdown = (text: string): string => text.replace(ESCAPED_PUNCTUATION_RE, '$1')

/** Reads `{key=value …}` into attrs. Unknown keys and values that fail their check are dropped. */
function readOptionBlock(
  block: string | undefined,
  keys: readonly MarkdownOptionKey[]
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {}
  if (!block) return attrs
  for (const match of block.matchAll(OPTION_RE)) {
    const key = KEY_FOR_NAME.get(match[1]) ?? match[1]
    if (!isOptionKey(key) || !keys.includes(key)) continue
    const value = OPTION_VALUES[key](match[2] ?? match[3] ?? match[4])
    if (value !== undefined) attrs[key] = value
  }
  return attrs
}

// Export reads a stored value back through its import check, so it never writes
// a value that import would drop. Null means unset.
const exportValue = (key: MarkdownOptionKey, value: unknown): unknown =>
  value == null ? null : OPTION_VALUES[key](String(value).replace(/"/g, '%22'))

/** Writes only the keys that differ from `defaults`, in `OPTION_VALUES` order. */
function writeOptionBlock(
  attrs: Record<string, unknown>,
  keys: readonly MarkdownOptionKey[],
  defaults: MarkdownOptionValues
): string {
  const parts: string[] = []
  for (const key of OPTION_KEYS) {
    if (!keys.includes(key)) continue
    const value = exportValue(key, attrs[key])
    if (value == null || value === exportValue(key, defaults[key])) continue
    const text = String(value)
    const name = OPTION_NAMES[key] ?? key
    parts.push(/^[^\s'{}]+$/.test(text) ? `${name}=${text}` : `${name}="${text}"`)
  }
  return parts.length ? `{${parts.join(' ')}}` : ''
}

/** The caption rides the CommonMark title slot: ` "My caption"`, or nothing. */
function writeCaptionTitle(caption: unknown): string {
  if (typeof caption !== 'string' || !caption.trim()) return ''
  const text = caption.trim().replace(/\s*\n\s*/g, ' ')
  return ` "${text.replace(/[\\"]/g, '\\$&')}"`
}

const readCaptionTitle = (quoted: string | undefined): string | undefined => {
  const text = quoted ? unescapeMarkdown(quoted.slice(1, -1)).trim() : ''
  return text || undefined
}

type MediaTailGroups = { title?: string; legacy?: string; block?: string }

/** Reads the caption and the options that follow the `src` of a matched token. */
function readMediaTail(
  groups: MediaTailGroups,
  keys: readonly MarkdownOptionKey[]
): { caption: string | undefined; options: Record<string, unknown> } {
  return {
    caption: readCaptionTitle(groups.title),
    options: { ...readOptionBlock(groups.legacy, keys), ...readOptionBlock(groups.block, keys) }
  }
}

/** Writes `(src "caption"){…}`, everything after `![alt]`. */
function writeMediaTail(
  attrs: Record<string, unknown>,
  keys: readonly MarkdownOptionKey[],
  defaults: MarkdownOptionValues
): string {
  const src = encodeDestination(attrs.src)
  return `(${src}${writeCaptionTitle(attrs.caption)})${writeOptionBlock(attrs, keys, defaults)}`
}

const pickDefaults = (
  options: MarkdownOptionValues,
  keys: readonly MarkdownOptionKey[]
): MarkdownOptionValues => Object.fromEntries(keys.map((key) => [key, options[key] ?? null]))

type MarkdownHookThis = { options: MarkdownOptionValues }

type ResolvedSrc = { src: string; defaults?: MarkdownOptionValues }

type TypedMediaMarkdownOptions = {
  /** Option-block keys this node reads and writes. */
  keys?: readonly MarkdownOptionKey[]
  /** Schema defaults that are not node options, so export can still leave them out. */
  defaults?: MarkdownOptionValues
  /** Canonical `src` and the defaults that depend on it. Null rejects the token on import. */
  resolveSrc?: (src: string) => ResolvedSrc | null
}

type MediaMarkdownHooks = {
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
    this: MarkdownHookThis,
    node: JSONContent,
    helpers: MarkdownRendererHelpers,
    ctx: RenderContext
  ) => string
}

/** `![{nodeName}](src "caption"){key=value}` import/export hooks shared by every non-image media node. */
export function createTypedMediaMarkdownHooks(
  nodeName: TypedMediaMarkdownAlt,
  {
    keys = EMBED_LAYOUT_ATTR_KEYS,
    defaults,
    resolveSrc = (src) => ({ src })
  }: TypedMediaMarkdownOptions = {}
): MediaMarkdownHooks {
  const tokenName = `hm_${nodeName}`
  const pattern = new RegExp(
    String.raw`^!\[${nodeName}\]\(${DESTINATION}${TITLE}${LEGACY_SIZE}\)(?:${OPTION_BLOCK})?`
  )

  return {
    markdownTokenName: tokenName,

    markdownTokenizer: {
      name: tokenName,
      level: 'inline' as const,
      start: (src: string) => src.indexOf(`![${nodeName}]`),
      tokenize: (src: string) => {
        const match = pattern.exec(src)
        if (!match?.groups || !TYPED_MEDIA_SRC_VALIDATORS[nodeName](match.groups.src)) {
          return undefined
        }
        const resolved = resolveSrc(match.groups.src)
        if (!resolved) return undefined
        const { caption, options } = readMediaTail(match.groups, keys)
        return {
          type: tokenName,
          raw: match[0],
          href: resolved.src,
          caption,
          options: { ...resolved.defaults, ...options }
        }
      }
    },

    parseMarkdown: (token: MarkdownToken) => ({
      type: nodeName,
      attrs: {
        src: token.href || '',
        ...(token.caption ? { caption: token.caption } : {}),
        ...token.options
      }
    }),

    renderMarkdown(this: MarkdownHookThis, node: JSONContent) {
      const attrs = node.attrs ?? {}
      const fallback = {
        ...pickDefaults(this.options, keys),
        ...defaults,
        ...resolveSrc(String(attrs.src ?? ''))?.defaults
      }
      return `![${nodeName}]${writeMediaTail(attrs, keys, fallback)}`
    }
  }
}

/**
 * `image` keeps marked's own `image` token for the plain form, and claims only `![alt](src){…}`.
 * Never route a reserved alt to its node type here: a typed node registers its tokenizer only
 * when it is enabled, and a node type the schema lacks blanks the document.
 */
export function createImageMarkdownHooks(keys: readonly MarkdownOptionKey[]): MediaMarkdownHooks {
  const pattern = new RegExp(
    String.raw`^!\[(?<alt>(?:[^\[\]\\\n]|\\.)*)\]\(${DESTINATION}${TITLE}\)${OPTION_BLOCK}`
  )

  return {
    markdownTokenName: 'image',

    markdownTokenizer: {
      name: 'hm_image',
      level: 'inline' as const,
      start: (src: string) => src.indexOf('!['),
      tokenize: (src: string): MarkdownToken | undefined => {
        const match = pattern.exec(src)
        if (!match?.groups) return undefined
        const alt = unescapeMarkdown(match.groups.alt)
        // marked tries the last tokenizer registered first, and Tiptap registers by priority.
        // So `x` (priority 101) runs after this tokenizer, and every other typed node before it.
        if (isTypedMediaAlt(alt) && TYPED_MEDIA_SRC_VALIDATORS[alt](match.groups.src)) {
          return undefined
        }
        const { caption, options } = readMediaTail(match.groups, keys)
        return {
          type: 'image',
          raw: match[0],
          href: match.groups.src,
          text: alt,
          title: caption,
          options
        }
      }
    },

    parseMarkdown: (token: MarkdownToken): JSONContent => {
      // Markdown import is a write boundary like paste and parseHTML: an
      // imported `![alt](javascript:…)` must not reach a stored node attribute.
      // `data:image/*` passes, the case `allowBase64` exists for.
      const href = isSafeMediaSrc(token.href, { allowInlineImage: true }) ? token.href : ''
      const caption = typeof token.title === 'string' ? token.title.trim() : ''
      return {
        type: 'image',
        attrs: {
          src: href,
          alt: token.text || '',
          ...(caption ? { caption } : {}),
          ...token.options
        }
      }
    },

    renderMarkdown(this: MarkdownHookThis, node: JSONContent): string {
      const attrs = node.attrs ?? {}
      const alt = String(attrs.alt ?? '').replace(/[[\]]/g, '\\$&')
      return `![${alt}]${writeMediaTail(attrs, keys, pickDefaults(this.options, keys))}`
    }
  }
}
