import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext
} from '@tiptap/core'
import { Highlight as BaseHighlight } from '@tiptap/extension-highlight'

/**
 * docs.plus Highlight: the upstream mark plus `==text==` markdown import/export.
 * `@tiptap/extension-highlight` is third-party, so its markdown can't live in the
 * package source — it belongs here with the extension, not in a shared markdown file.
 */
export const Highlight = BaseHighlight.extend({
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
