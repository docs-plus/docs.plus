import { isSafeHref } from '@docs.plus/extension-hyperlink'
import { Mark, mergeAttributes } from '@tiptap/core'

// Schema-compat mark for stored legacy `link` marks under enableContentCheck.
// HyperlinkBase owns UI, commands, and Markdown link parsing.
export const LegacyLink = Mark.create({
  name: 'link',
  keepOnSplit: false,
  inclusive: false,

  addAttributes() {
    return {
      href: { default: null },
      target: { default: null, rendered: false },
      rel: { default: 'noopener noreferrer nofollow' },
      class: { default: null, parseHTML: () => null, rendered: false },
      title: { default: null }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[href]',
        getAttrs: (dom: HTMLElement | string) => {
          if (typeof dom === 'string') return false
          const href = dom.getAttribute('href') ?? ''
          return isSafeHref(href) ? null : false
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const href = typeof HTMLAttributes.href === 'string' ? HTMLAttributes.href : null
    const safe = isSafeHref(href) ? HTMLAttributes : { ...HTMLAttributes, href: '' }
    return ['a', mergeAttributes({ rel: 'noopener noreferrer nofollow' }, safe), 0]
  },

  renderMarkdown(node, helpers) {
    const content = helpers.renderChildren(node)
    const raw = typeof node.attrs?.href === 'string' ? node.attrs.href : ''
    const href = (isSafeHref(raw) ? raw : '').replace(/\)/g, '%29').replace(/\s/g, '%20')
    return `[${content}](${href})`
  }
})
