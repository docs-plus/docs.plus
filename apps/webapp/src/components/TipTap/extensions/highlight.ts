import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext
} from '@tiptap/core'
import { Highlight as BaseHighlight } from '@tiptap/extension-highlight'

// Hex or a numeric rgb()/rgba(), as `style.backgroundColor` serializes it.
// Anything else could smuggle extra declarations into `style`.
const SAFE_COLOR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\([\d\s.,]+\))$/i

const safeColor = (value: unknown): string | null =>
  typeof value === 'string' && SAFE_COLOR.test(value.trim()) ? value.trim() : null

/**
 * docs.plus Highlight: the upstream mark plus `==text==` markdown import/export.
 * `@tiptap/extension-highlight` is third-party, so its markdown can't live in the
 * package source — it belongs here with the extension, not in a shared markdown file.
 */
export const Highlight = BaseHighlight.extend({
  // The server stores `color`. Upstream adds it only with multicolor on.
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          safeColor(element.getAttribute('data-color') || element.style.backgroundColor),
        // Stored marks and raw Yjs updates skip parseHTML, so render checks too.
        renderHTML: (attributes: { color?: string | null }) => {
          const color = safeColor(attributes.color)
          if (!color) return {}
          return { 'data-color': color, style: `background-color: ${color}` }
        }
      }
    }
  },

  markdownTokenName: 'highlight',

  markdownTokenizer: {
    name: 'highlight',
    level: 'inline' as const,
    start: (src: string) => {
      const i = src.indexOf('==')
      return i >= 0 ? i : -1
    },
    tokenize: (src: string, _tokens: MarkdownToken[], lexer: MarkdownLexerConfiguration) => {
      const match = /^==([^=]+)==/.exec(src)
      if (!match) return undefined
      return {
        type: 'highlight',
        raw: match[0],
        text: match[1],
        tokens: lexer.inlineTokens(match[1])
      }
    }
  },

  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) =>
    helpers.applyMark('highlight', helpers.parseInline(token.tokens ?? [])),

  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers, _ctx: RenderContext) =>
    `==${helpers.renderChildren(node)}==`
})
