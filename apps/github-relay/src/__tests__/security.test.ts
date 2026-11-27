import { describe, expect, it } from 'bun:test'
import { createHmac } from 'crypto'

import {
  cleanText,
  extractCommentExcerpt,
  isSafeHttpsUrl,
  sanitizeChip,
  stripHtmlAndExtractBanner,
  truncateMarkdownSafe,
  verifyGitHubSignature
} from '../security.ts'

describe('verifyGitHubSignature', () => {
  const secret = 'test-webhook-secret'
  const payload = new TextEncoder().encode(JSON.stringify({ hello: 'world' }))
  const validHex = createHmac('sha256', secret).update(payload).digest('hex')

  it('accepts a matching sha256 signature', () => {
    expect(verifyGitHubSignature(payload, `sha256=${validHex}`, secret)).toBe(true)
  })

  it('rejects missing, malformed, or tampered signatures', () => {
    expect(verifyGitHubSignature(payload, null, secret)).toBe(false)
    expect(verifyGitHubSignature(payload, 'sha256=deadbeef', secret)).toBe(false)
    expect(verifyGitHubSignature(payload, `sha1=${validHex}`, secret)).toBe(false)
    const tampered = new TextEncoder().encode('{"hello":"evil"}')
    expect(verifyGitHubSignature(tampered, `sha256=${validHex}`, secret)).toBe(false)
  })
})

describe('text sanitization', () => {
  it('strips C0 control chars and bidi overrides while keeping Persian ZWNJ and emoji ZWJ', () => {
    const input = 'سلام\u200cدنیا 👋\u200d💻 \u0007\u202e[click](https://evil.example)'
    const out = cleanText(input)
    expect(out).toContain('سلام\u200cدنیا')
    expect(out).toContain('👋\u200d💻')
    expect(out).not.toContain('\u202e')
    expect(out).not.toContain('\u0007')
    expect(out).toContain('] (https://evil.example)')
  })

  it('caps label chips at 30 chars without backticks', () => {
    expect(sanitizeChip('`good` `first` `issue`')).toBe('good first issue')
    expect(sanitizeChip('a-very-long-label-name-exceeding-thirty-chars')).toBe(
      'a-very-long-label-name-exceed…'
    )
  })

  it('allows only https URLs for buttons and media', () => {
    expect(isSafeHttpsUrl('https://github.com/docs-plus/docs.plus')).toBe(true)
    expect(isSafeHttpsUrl('http://github.com')).toBe(false)
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpsUrl('')).toBe(false)
  })
})

describe('HTML stripping and markdown-safe truncation', () => {
  it('extracts banner URL from <picture> and strips raw HTML tags', () => {
    const raw = `<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://docs.plus/demo-assets/release-2.3.6-banner-dark.png">
  <img alt="Release" src="https://docs.plus/demo-assets/release-2.3.6-banner.png">
</picture>

**docs.plus 2.3.6 is here.** Reads are faster.`

    const { text, bannerUrl } = stripHtmlAndExtractBanner(raw)
    expect(bannerUrl).toBe('https://docs.plus/demo-assets/release-2.3.6-banner-dark.png')
    expect(text).toBe('**docs.plus 2.3.6 is here.** Reads are faster.')
    expect(text).not.toContain('<picture')
  })

  it('never cuts mid-word on the v2.3.6 Large regression', () => {
    const prefix = `${'a '.repeat(42)}London answered faster. `
    const text = `${prefix}Larger changes shipped across the document sync layer.`
    const res = truncateMarkdownSafe(text, prefix.length + 10)
    expect(res.truncated).toBe(true)
    expect(res.text).not.toContain('Larg…')
    expect(res.text.endsWith('…')).toBe(true)
  })

  it('closes unclosed triple-backtick code fences when truncated', () => {
    const body = 'Intro line\n\n```ts\nconst a = 1\nconst b = 2\nconst c = 3\n```'
    const res = truncateMarkdownSafe(body, 36)
    expect(res.truncated).toBe(true)
    const fences = res.text.match(/```/g) ?? []
    expect(fences.length % 2).toBe(0)
  })

  it('extracts comment excerpts without quoted lines or HTML comments', () => {
    const comment = `<!-- hidden -->\n> Quoted parent line\n\nUpdated Safari scroll guard.\n\n\`\`\`ts\nx()\n\`\`\``
    expect(extractCommentExcerpt(comment, 100)).toBe('Updated Safari scroll guard. [code]')
  })

  it('ignores banner tags in code fences and HTML comments and strips bidi/C0 inside fences', () => {
    const raw = [
      '<!-- <img src="https://evil.example/comment-banner.png"> -->',
      '```html',
      '<img src="https://evil.example/code-banner.png">\u0007\u202e',
      '```',
      '',
      '<img src="https://docs.plus/real-banner.png">',
      'Release notes body.'
    ].join('\n')

    const { text, bannerUrl } = stripHtmlAndExtractBanner(raw)
    expect(bannerUrl).toBe('https://docs.plus/real-banner.png')
    expect(text).toContain('<img src="https://evil.example/code-banner.png">')
    expect(text).not.toContain('\u0007')
    expect(text).not.toContain('\u202e')
  })
})
