import { Hyperlink } from '@docs.plus/extension-hyperlink'
import { HyperMultimediaImage } from '@docs.plus/extension-hypermultimedia'
import type {
  JSONContent,
  MarkdownLexerConfiguration,
  MarkdownParseHelpers,
  MarkdownRendererHelpers,
  MarkdownToken,
  RenderContext
} from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'

export const HyperlinkWithMarkdown = Hyperlink.extend({
  markdownTokenName: 'link',

  parseMarkdown: (token: MarkdownToken, helpers: MarkdownParseHelpers) => {
    return helpers.applyMark('hyperlink', helpers.parseInline(token.tokens ?? []), {
      href: token.href || ''
    })
  },

  renderMarkdown: (node: JSONContent, helpers: MarkdownRendererHelpers, _ctx: RenderContext) => {
    const content = helpers.renderChildren(node).replace(/\]/g, '\\]')
    const href = (node.attrs?.href || '').replace(/\)/g, '%29')
    return `[${content}](${href})`
  }
})

export const ImageWithMarkdown = HyperMultimediaImage.extend({
  markdownTokenName: 'image',

  parseMarkdown: (token: MarkdownToken, _helpers: MarkdownParseHelpers) => ({
    type: 'Image',
    attrs: { src: token.href || '', alt: token.text || '' }
  }),

  renderMarkdown: (node: JSONContent, _helpers: MarkdownRendererHelpers, _ctx: RenderContext) => {
    const alt = (node.attrs?.alt || '').replace(/\]/g, '\\]')
    const src = (node.attrs?.src || '').replace(/\)/g, '%29')
    return `![${alt}](${src})`
  }
})

export const HighlightWithMarkdown = Highlight.extend({
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
