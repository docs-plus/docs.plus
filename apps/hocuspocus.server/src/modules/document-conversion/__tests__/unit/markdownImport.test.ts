import { describe, expect, test } from 'bun:test'

import { exportMarkdown } from '../../domain/markdownExport'
import {
  importMarkdown,
  MarkdownTooDeepError,
  MAX_MARKDOWN_NESTING,
  parseMarkdown,
  wrapStrayInlineNodes
} from '../../domain/markdownImport'

const types = (content: Record<string, unknown>[]) => content.map((node) => node.type)

const firstBlock = (markdown: string) => parseMarkdown(markdown).content[0] as Record<string, any>

const firstText = (markdown: string) => firstBlock(markdown).content[0] as Record<string, any>

// #335: StarterKit's `link` claimed the token while it came first, and the pad
// cannot preview or edit a `link` mark.
describe('parseMarkdown', () => {
  test('puts a Markdown link on the hyperlink mark', () => {
    const text = firstText('[Budget](https://example.test/p?id=a)')

    expect(text.marks).toHaveLength(1)
    expect(text.marks[0].type).toBe('hyperlink')
    expect(text.marks[0].attrs.href).toBe('https://example.test/p?id=a')
  })

  test('keeps bold next to the hyperlink mark', () => {
    const text = firstText('**[bold](https://a.test)**')

    expect(text.marks.map((mark: Record<string, unknown>) => mark.type).sort()).toEqual([
      'bold',
      'hyperlink'
    ])
  })

  // #721: at its editor priority the code mark nests outside bold, so export
  // wrote `**` inside the backticks and the next import read literal asterisks.
  test('round-trips bold, italic and stored `code` marks on inline code', () => {
    const markdown = '- **`hovercard`** takes *`x`* and ~~`y`~~'

    expect(exportMarkdown(parseMarkdown(markdown))).toBe(markdown)
    expect(
      exportMarkdown({
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'old', marks: [{ type: 'code' }] }] }
        ]
      })
    ).toBe('`old`')
  })

  test('still turns a bare media URL on its own line into media', () => {
    const paragraph = firstBlock('https://example.test/pic.png')

    expect(paragraph.content[0].type).toBe('image')
    expect(paragraph.content[0].attrs.src).toBe('https://example.test/pic.png')
  })
})

describe('importMarkdown', () => {
  // `marked` emits a lone image as a root node. `image` is inline, so the result
  // used to fail `PATCH /content` with "Invalid content for node doc", and the
  // two documented routes did not compose.
  test('wraps a root-level image so the content PATCH accepts the result', () => {
    const { content } = importMarkdown(
      '# Probe\n\nA paragraph.\n\n![alt text](https://example.test/pic.png)\n',
      'Fallback'
    )

    expect(types(content.content)).toEqual(['heading', 'paragraph', 'paragraph'])

    const wrapper = content.content[2] as Record<string, any>
    expect(wrapper.content[0].type).toBe('image')
    expect(wrapper.content[0].attrs.src).toBe('https://example.test/pic.png')
  })

  test('leaves block nodes at the root untouched', () => {
    const { content } = importMarkdown('# Probe\n\nOne.\n\n> Quoted.\n\n- item\n', 'Fallback')

    expect(types(content.content)).toEqual(['heading', 'paragraph', 'blockquote', 'bulletList'])
  })

  // `blockquote` takes blocks, so a quoted lone image hit the same 422 one level
  // down: "Invalid content for node blockquote: <image>".
  test('wraps an inline node inside a block container, not only at the root', () => {
    const { content } = importMarkdown(
      '# Probe\n\n> ![alt text](https://example.test/pic.png)\n',
      'Fallback'
    )

    const quote = content.content[1] as Record<string, any>
    expect(quote.type).toBe('blockquote')
    expect(types(quote.content)).toEqual(['paragraph'])
    expect(quote.content[0].content[0].type).toBe('image')
  })

  test('leaves a paragraph’s own inline children alone', () => {
    const { content } = importMarkdown(
      '# Probe\n\nText ![alt](https://example.test/p.png) more\n',
      'Fallback'
    )

    const para = content.content[1] as Record<string, any>
    expect(para.type).toBe('paragraph')
    expect(types(para.content)).toEqual(['text', 'image', 'text'])
  })
})

describe('parseMarkdown — nesting guard', () => {
  test('rejects deep blockquotes and lists past MAX_MARKDOWN_NESTING without RangeError', () => {
    const over = MAX_MARKDOWN_NESTING + 1
    const cases = [
      `${'> '.repeat(over)}hi`,
      `${'> '.repeat(5000)}hi`,
      `${'>'.repeat(over)}hi`,
      `${'- '.repeat(over)}hi`,
      `${'* '.repeat(over)}hi`,
      `${'+ '.repeat(over)}hi`,
      `${'123. '.repeat(over)}hi`,
      `${'42) '.repeat(over)}hi`,
      `${'  '.repeat(over)}- hi`,
      `${'\t'.repeat(17)}- hi`,
      `${'\t'.repeat(17)}hi`,
      Array.from({ length: over }, (_, i) => `${'  '.repeat(i)}- item`).join('\n'),
      Array.from({ length: over }, (_, i) => `${'  '.repeat(i)}-`).join('\n'),
      `${'> - '.repeat(17)}hi`,
      Array.from({ length: over }, (_, i) => `${'> '.repeat(i)}- a`).join('\n')
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('accepts nesting up to MAX_MARKDOWN_NESTING including deep inline images', () => {
    const atLimit = [
      `${'> '.repeat(MAX_MARKDOWN_NESTING)}hi`,
      `${'- '.repeat(MAX_MARKDOWN_NESTING)}hi`,
      `${'-\t'.repeat(MAX_MARKDOWN_NESTING)}hi`,
      `${'100. '.repeat(MAX_MARKDOWN_NESTING)}hi`,
      Array.from({ length: MAX_MARKDOWN_NESTING }, (_, i) => `${'  '.repeat(i)}- item`).join('\n'),
      `${'> '.repeat(MAX_MARKDOWN_NESTING)}![alt](https://example.test/p.png)`
    ]
    for (const markdown of atLimit) {
      expect(() => parseMarkdown(markdown)).not.toThrow()
    }
  })

  test('exempts deep markers inside backtick and tilde fenced code blocks', () => {
    const deep = `${'> '.repeat(200)}hi`
    const fenced = [
      `\`\`\`mermaid\n${deep}\n\`\`\``,
      `~~~\n${'- '.repeat(200)}hi\n~~~`,
      `\`\`\`\`\n\`\`\`\n${deep}\n\`\`\`\`\n`,
      `\`\`\`\n${deep}`,
      `  \`\`\`\n${deep}\n  \`\`\``,
      `\`\`\`\n\`\`\`js\n${deep}\n\`\`\``,
      `- a\n  \`\`\`\n  ${deep}\n  \`\`\``,
      `- a\n  \`\`\`\n      \`\`\`\n  ${deep}\n  \`\`\``,
      `- a\n  \`\`\`\n  \t\`\`\`\n  ${deep}\n  \`\`\``,
      `\`\`\`\r${deep}\r\`\`\``,
      `\`\`\`\r\n${deep}\r\n\`\`\``,
      `1. **Step**\n\n   \`\`\`bash\n   ${deep}\n   \`\`\``,
      `<pre>ok</pre>\n\`\`\`\n${deep}\n\`\`\``,
      `<div>ok</div>\n\n\`\`\`\n${deep}\n\`\`\``,
      `<https://example.test>\n\`\`\`\n${deep}\n\`\`\``,
      `[ref]: https://example.test "title"\n\`\`\`\n${deep}\n\`\`\``,
      `[NOTE]\n\`\`\`\n${deep}\n\`\`\``,
      `- a\n  \`\`\`\n0-indent\n  \`\`\`\n\n\`\`\`\necho ok\n\`\`\``,
      `- [ ] a\n\n  \`\`\`\n  ${deep}\n  \`\`\``,
      `para\n<custom-tag>\n\`\`\`\n${deep}\n\`\`\``,
      `para\n[ref]: https://example.test\n\`\`\`\n${deep}\n\`\`\``,
      `[a]: https://example.test "title" extra\n\`\`\`\n${deep}\n\`\`\``,
      `> quote\n\`\`\`\n${deep}\n\`\`\``,
      `> 1. a\n\n\`\`\`sql\n${deep}\n\`\`\``,
      `<?xml version="1.0"?> text\n\`\`\`\n${deep}\n\`\`\``,
      `<precustom>\n\`\`\`\n${deep}\n\`\`\``,
      `1. a\n\n x\n\`\`\`\n${deep}\n\`\`\``,
      `| a | b |\n| --- | --- |\n\t \n\`\`\`\n${deep}\n\`\`\``,
      `> - a\n>\t\tcode\n\`\`\`\n${deep}\n\`\`\``,
      `| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n\n\`\`\`\n${deep}\n\`\`\``,
      `| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n\`\`\`\n${'> '.repeat(10)}hi\n\`\`\``,
      `  x\n2. a\n--- | ---\n  \`\`\`\n  ${deep}\n  \`\`\``,
      `| \` \`\` \`\`\` \`\`\`\` \`\`\`\`\` \`\`\`\`\`\` \`a|b\` \`c|d\` \`e|f\` | x |\n| --- | --- |\n\n\`\`\`\n${deep}\n\`\`\``,
      `x- [ ] a\n\n\`\`\`\n${deep}\n\`\`\``,
      `    - a\n\n\`\`\`\n${deep}\n\`\`\``,
      `- a\n<precustom>\n\n\`\`\`\n${deep}\n\`\`\``
    ]
    for (const markdown of fenced) {
      expect(() => parseMarkdown(markdown)).not.toThrow()
    }
  })

  test('rejects fence bypasses (4-space indent, backtick info string, > fence, list breakout)', () => {
    const bypasses = [
      `    \`\`\`\n${'> '.repeat(500)}hi`,
      `\`\`\`a\`b\n${'> '.repeat(500)}hi`,
      `> \`\`\`\n${'- '.repeat(500)}hi`,
      `- a\n  \`\`\`\n${'> '.repeat(5000)}hi`,
      `- a\n  \`\`\`\n\n${'> '.repeat(5000)}hi`
    ]
    for (const markdown of bypasses) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects bare CR (\\r) line-break bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `hi\r${deep}`,
      `\`\`\`\r\`\`\`\r${deep}`,
      `~~~\r~~~\r${deep}`,
      `- a\r  \`\`\`\r    \`\`\`\r  ${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects list-indented closing fence bypasses (4-space, 5-space, tab, and lower-indent close)', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `- a\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `- a\n  \`\`\`\n     \`\`\`\n  ${deep}`,
      `- a\n  \`\`\`\n\t\`\`\`\n  ${deep}`,
      `- a\n  \`\`\`\n \t\`\`\`\n  ${deep}`,
      `- a\n  ~~~\n    ~~~\n  ${deep}`,
      `- a\n  ~~~\n     ~~~\n  ${deep}`,
      `- a\n  ~~~\n\t~~~\n  ${deep}`,
      `1. a\n   \`\`\`\n     \`\`\`\n   ${deep}`,
      `1. a\n   \`\`\`\n\t\`\`\`\n   ${deep}`,
      `1. a\n   \`\`\`\n  \`\`\`\n   ${deep}`,
      `- a\n   \`\`\`\n  \`\`\`\n  ${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects lazy-continuation and empty EOL list-marker fence bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `- a\nlazy\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `- a\nlazy\n  \`\`\`\n     \`\`\`\n  ${deep}`,
      `- a\nlazy\n  \`\`\`\n\t\`\`\`\n  ${deep}`,
      `1. a\nlazy\n   \`\`\`\n     \`\`\`\n   ${deep}`,
      `* a\n  b\nlazy\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `- a\nlazy\n  ~~~\n    ~~~\n  ${deep}`,
      `- a\r\nlazy\r\n  \`\`\`\r\n    \`\`\`\r\n  ${deep}`,
      `-\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `*\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `+\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `-\n  \`\`\`\n\t\`\`\`\n  ${deep}`,
      `1.\n   \`\`\`\n     \`\`\`\n   ${deep}`,
      `1)\n   \`\`\`\n     \`\`\`\n   ${deep}`,
      ` -\n   \`\`\`\n     \`\`\`\n   ${deep}`,
      `-\r  \`\`\`\r    \`\`\`\r  ${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects parity-flip, mixed-char, trailing-tab, and list-exit fence bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `- a\n  \`\`\`\n\`\`\`\n  \`\`\`\n${deep}`,
      `- a\n  \`\`\`\n \`\`\`\n  \`\`\`\n${deep}`,
      `- a\n  ~~~\n ~~~\n  ~~~\n${deep}`,
      `1. a\n   \`\`\`\n  \`\`\`\n   \`\`\`\n     \`\`\`\n   ${deep}`,
      `1. a\n   \`\`\`\n  \`\`\`js\n     \`\`\`\n   ${deep}`,
      `1. a\n   \`\`\`\n  foo\n  \`\`\`\n  ${deep}`,
      `- a\n\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `\`\`\`\nhello\n\`\`\`~~~\n${deep}`,
      `~~~\nhello\n~~~\`\`\`\n${deep}`,
      `\`\`\`\nhello\n\`\`\`\t\n\`\`\`\n${deep}`,
      `  - a\n   \`\`\`\n      \`\`\`\n   \`\`\`\n   ${deep}`,
      `-   a\n   \`\`\`\n      \`\`\`\n   \`\`\`\n   ${deep}`,
      `- a\n  \`\`\`\n\`\`\`\n  \`\`\`\n  ${deep}`,
      `- a\n  \`\`\`\n \`\`\`\n  \`\`\`\n  ${deep}`,
      `1. a\n   \`\`\`\n\`\`\`\n   \`\`\`\n   ${deep}`,
      `- [ ] a\n  \`\`\`\n\`\`\`\n  \`\`\`\n  ${deep}`,
      `- a\n\n\tx\n  \`\`\`\n    \`\`\`\n  ${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects bullet-list inline HTML and link-definition fence bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `- <div>\n  \`\`\`\n\n  ${deep}`,
      `* <pre>\n  \`\`\`\n  </pre>\n  ${deep}`,
      `+ <!--\n  \`\`\`\n  -->\n  ${deep}`,
      `- [a]: https://example.test "\n  \`\`\`\n  "\n  ${deep}`,
      `- [a\n  \`\`\`\n  ]: https://example.test\n  ${deep}`,
      `- [a]:\n  \`\`\`\n\n  ${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects HTML block and multiline link-definition fence bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `<pre>\n\`\`\`\n</pre>\n${deep}`,
      `<script>\n\`\`\`\n</script>\n${deep}`,
      `<!--\n\`\`\`\n-->\n${deep}`,
      `<?\n\`\`\`\n?>\n${deep}`,
      `<!DOCTYPE\n\`\`\`\n>\n${deep}`,
      `<!doctype\n\`\`\`\n>\n${deep}`,
      `<![CDATA[\n\`\`\`\n]]>\n${deep}`,
      `<![cdata[\n\`\`\`\n]]>\n${deep}`,
      `<div>hello</div>\n\`\`\`\n\n${deep}`,
      `<custom-widget a="1">\n\`\`\`\n\n${deep}`,
      `</custom-widget>\n\`\`\`\n\n${deep}`,
      `[a\n\`\`\`\n]: https://example.test\n${deep}`,
      `[a\\\n\`\`\`\n]: https://example.test\n${deep}`,
      `[a]:\n  \`\`\`\n\n${deep}`,
      `[a]: https://example.test "\n\`\`\`\n"\n${deep}`,
      `[a]: https://example.test '\n\`\`\`\n'\n${deep}`,
      `[a]: https://example.test (\n\`\`\`\n)\n${deep}`,
      `para\n<custom-tag>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `para\n</custom-tag>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `para\n<?\n\`\`\`\n?>\n\`\`\`\n${deep}`,
      `para\n<!DOCTYPE\n\`\`\`\n>\n\`\`\`\n${deep}`,
      `para\n<![CDATA[\n\`\`\`\n]]>\n\`\`\`\n${deep}`,
      `para\n <div>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `para\n<PRE>\n\`\`\`\n</PRE>\n\`\`\`\n${deep}`,
      `para\n<DIV>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `> # h\n<custom-tag>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `> hello\n<DIV>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `| a | b |\n| --- | --- |\n<custom-tag>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `| a | b |\n| --- | --- |\n[a]: https://x "\n\`\`\`\n"\n\`\`\`\n${deep}`,
      `para\n[a\n\`\`\`\n]: https://example.test\n\`\`\`\n${deep}`,
      `para\n[a]:\n\`\`\`\n\n\`\`\`\n${deep}`,
      `para\n[a]: https://example.test "\n\`\`\`\n"\n\`\`\`\n${deep}`,
      `- a\npara\n[b]: https://example.test "\n\`\`\`\n"\n\`\`\`\n${deep}`,
      `[a]: https://example.test "foo\n\`\`\`\n" extra\n\`\`\`\n${deep}`,
      `[a]: https://example.test 'foo\n\`\`\`\n' extra\n\`\`\`\n${deep}`,
      `[a]: https://example.test (foo\n\`\`\`\n) extra\n\`\`\`\n${deep}`,
      `[a]: https://example.test "foo\n\`\`\`\n"\t\n\`\`\`\n${deep}`,
      `[a]: https://example.test "foo\\\\"\n\`\`\`\n"\n\`\`\`\n\n\`\`\`\n${deep}`,
      `[a]: https://example.test (a\n\`\`\`\n(\n)\n\`\`\`\n${deep}`,
      `[a]: https://example.test 'a\n\`\`\`\n\n'\n\`\`\`\n${deep}`,
      `[a\n\`\`\`\n]: https://example.test extra\n\`\`\`\n${deep}`,
      `[a]:\n\`\`\`\t\n\`\`\`\n${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects taskList and orderedList dedent, split, and JS whitespace bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `- [ ] a\n \`\`\`\n     \`\`\`\n ${deep}`,
      `- [ ] a\n \`\`\`\n   \t\`\`\`\n ${deep}`,
      `- [ ] a\n\t\`\`\`\n\t\`\`\`\n${deep}`,
      `- [ ] a\n\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `- [x] a\n\n  ~~~\n    ~~~\n  ${deep}`,
      `- [ ] a\n\n     <pre>\n  \`\`\`\n     </pre>\n  ${deep}`,
      `10. a\n  \`\`\`\n      \`\`\`\n  ${deep}`,
      `${'1'.padEnd(21, '0')}. a\n  \`\`\`\n                        \`\`\`\n  ${deep}`,
      `a. foo\nlazy\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `ca. item\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `i. item\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1. a\n  \`\`\`\n\t\t\`\`\`\n  ${deep}`,
      `1. a\n   \`\`\`\n   2. b\n   ${deep}`,
      `10. a\n    \`\`\`\n  \`\`\`\n${deep}`,
      `1. a\n\u00A0\u00A0${deep}`,
      `1. a\n\v\v${deep}`,
      `1. a\n\f\f${deep}`,
      `1. a\n\u00A0\u00A0\`\`\`\n  \`\`\`\n${deep}`,
      `1. a\n\n\tx\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1. a\n\n\u00A0x\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1. a\n\n\u2003x\n  \`\`\`\n    \`\`\`\n  ${deep}`,
      `1000. a\n\n     <pre>\n  \`\`\`\n     </pre>\n  ${deep}`,
      `1000. a\n\n     <div>\n  \`\`\`\n\n  ${deep}`,
      `100. a\n\n    [x\n \`\`\`\n    ]: https://example.test\n ${deep}`,
      `1000. a\n\n     [x]: https://example.test "\n  \`\`\`\n     "\n  ${deep}`,
      `1. hello\n   <pre>\n   \`\`\`\n   </pre>\n   \`\`\`\n   ${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects closed-fence, tab-hr list, blockquote code, and table code bypasses without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      `\`\`\`\n\`\`\`\n<custom>\n\`\`\`\n\n${deep}`,
      `\`\`\`\n\`\`\`\n[a]:\n\`\`\`   \n${deep}`,
      `~~~\n~~~\n[a]:\n\`\`\`   \n${deep}`,
      `\`\`\`\n\`\`\`\n   <div>\n\`\`\`\n\n${deep}`,
      `\`\`\`\n\`\`\`\n<DIV>\n\`\`\`\n\n${deep}`,
      `- a\n---\t\n   \`\`\`\n${deep}`,
      `- a\n***\t\n   \`\`\`\n${deep}`,
      `- a\n___\t\n   \`\`\`\n${deep}`,
      `- a\n  ---\n   \`\`\`\n${deep}`,
      `>     code\n<custom>\n\`\`\`\n\n${deep}`,
      `> \tcode\n<custom>\n\`\`\`\n\n${deep}`,
      `> >     code\n<custom>\n\`\`\`\n\n${deep}`,
      `>     code\n[a]:\n\`\`\`   \n${deep}`,
      `| a | b |\n| --- | --- |\n    code\n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n\tcode\n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\npara\n    code\n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n===\n<custom>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `para\n\t\n<custom>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `| a | b |\n| --- | --- |\n\t\n<custom>\n\`\`\`\n\n\`\`\`\n${deep}`,
      `-\n- [x] a\n===\n\u00A0x\n'\n  \`\`\`\n${deep}`,
      `  \tcode\r\n| c | d |\r\n     <pre>\r\n<!DOCTYPE\r\n ---\r\n\`\`\`   \r\n<?\r\n\tcode\r\n${deep}`,
      `<!doctype\n \n</PRE>\n<!DOCTYPE\n\`\`\`\n-->\n${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('rejects mid-line HTML closes, HTML prefix lookalikes, multi-line close tags, table tab-code or backtick-pipe exits, list whitespace exits, and blockquote-list fence eats without RangeError', () => {
    const deep = `${'> '.repeat(5000)}hi`
    const cases = [
      // HTML Types 3, 4, and 5 mid-line termination (trailing quotes, fence, or list)
      `<? ?> ${deep}`,
      `<!DOCTYPE > ${deep}`,
      `<![CDATA[ ]]> ${deep}`,
      `<?\n?> ${deep}`,
      `<!DOCTYPE >\`\`\`\n\`\`\`\n${deep}`,
      `<?\n?> \`\`\`\n   \`\`\`\n${deep}`,
      `<!DOCTYPE\n> \`\`\`\n   \`\`\`\n${deep}`,
      `<![CDATA[\n]]> \`\`\`\n   \`\`\`\n${deep}`,
      `<!doctype\n> - a\n   \`\`\`\n${deep}`,
      `<?\n?> - a\n   \`\`\`\n${deep}`,
      `<![CDATA[\n]]> - a\n   \`\`\`\n${deep}`,
      `<!doctype > <custom>\n\`\`\`\n\n${deep}`,
      `<![CDATA[]]> [a]:\n\`\`\`\n${deep}`,

      // Non-raw HTML prefix lookalikes (excluded by lookahead without word boundary) and multi-line close tags
      `<precustom>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `</precustom>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `<scriptx>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `<stylex>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `<textareax>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `<precustom>\n   \`\`\`\n\t\t\n\`\`\`   \n${deep}`,
      `</foo\n>\n\`\`\`\n\n${deep}`,
      `</foo\n\n>\n\`\`\`\n\n${deep}`,
      `</foo\n\t\n>\n\`\`\`\n\n${deep}`,

      // Table terminated by indented-code whitespace blank lines or backtick-pipe single-line over-consumption
      `| a | b |\n| --- | --- |\n\t \n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n\t\t\n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n    \t\n<custom>\n\`\`\`\n\n${deep}`,
      `| a | b |\n| --- | --- |\n    \u00A0\n<custom>\n\`\`\`\n\n${deep}`,
      `a | b\n--- | ---\n\t \n[a]:\n\`\`\`   \n${deep}`,
      `| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`,
      `| \`a|b\` | c |\n| --- | --- |\n| 1 | 2 |\n<custom>\n\`\`\`\n\n${deep}`,

      // Ordered and task lists exited by blank + 1-space, blank-free 1-space, or JS-whitespace blank lines
      `10. a\n\n x\n<custom>\n\`\`\`\n\n${deep}`,
      `1. a\n\n x\n[a]:\n\`\`\`\n${deep}`,
      `- [ ] a\n x\n<custom>\n\`\`\`\n\n${deep}`,
      `- [ ] a\n\n x\n[a]:\n\`\`\`\n${deep}`,
      `1. a\n\t\n<custom>\n\`\`\`\n\n${deep}`,
      `2. a\npara\n\t\n[a]:\n~~~\n${deep}`,
      `1. a\n \t\n<!DOCTYPE\n\`\`\`\t\n${deep}`,
      `a. a\n\t\n<custom>\n\`\`\`\n\n${deep}`,
      `i. a\n\t\n<custom>\n\`\`\`\n\n${deep}`,
      `1. a\n\u00A0\n<custom>\n\`\`\`\n\n${deep}`,
      `1. a\n\v\n<custom>\n\`\`\`\n\n${deep}`,
      `1. a\n\f\n<custom>\n\`\`\`\n\n${deep}`,
      `___\t\n1. a\n    \t\n<!DOCTYPE\n2. a\n~~~\n${deep}`,

      // Blockquote + list + tabbed/indented code before reference definition
      `> - a\n>\t\tcode\n[a]:\n\`\`\`\`\n\`\`\`\`\n${deep}`,
      `> 1. a\n>\t\tcode\n[a]:\n\`\`\`\`\n\`\`\`\`\n${deep}`,

      // Nested blockquote + list raw-length overrun eating opening fence character
      `> 1. a\n> > - a\n[a]:\n\`\`\`ts\n${deep}`,
      `> - a\n  x\n> - b\n'\n\`\`\`ts\n${deep}`,
      `> - a\n    code\n> 1. a\n'\n\`\`\`ts\n${deep}`,
      `> > 1. a\n> > > \n| --- | --- |\n\`\`\`   \n${deep}`,
      `> 1. a\n> > \na | b\n~~~\n${deep}`,
      `> 1. a\n> > \n    code\n\`\`\`\t\n${deep}`,
      `> 1. a\n> > - a\n   \t\n~~~\n${deep}`,
      `${'> 1. a\n> > - a\n'.repeat(4)}[a]:\n\`\`\`\n${deep}`,

      // Paragraph + ordered-list + table-separator lookahead, taskList tab exits, and mid-line table/taskList splits
      `  x\n2. a\n--- | ---\n   \`\`\`\n-\t\n${deep}`,
      `  x\n    2. a\n--- | ---\n   \`\`\`\n-\t\n${deep}`,
      `  x\n2. a\n:---:\n    code\n   \`\`\`\n-\t\n${deep}`,
      `  - [ ] a\n   \`\`\`\n\tx\n   ${deep}`,
      `  - [ ] a\n   \`\`\`\n\t\u00A0x\n   ${deep}`,
      `| \` \`\` \`\`\` \`\`\`\` \`\`\`\`\` \`\`\`\`\`\` \`a|b\` \`c|d\` \`e|f\` | x |\n| --- | --- |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`,
      `| \\\`a|b\\\` | c |\n| --- | --- |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`,
      `x | \`a|b\` | c |\n| --- | --- |\n\`\`\`\n\`\`\`\n\`\`\`\n${deep}`,
      `x | a | b |\n| --- | --- |\n    \u00A0\n<custom>\n\`\`\`\n\n${deep}`,
      `x- [ ] a\n x\n<custom>\n\`\`\`\n\n${deep}`,
      `x    - [ ] a\n     x\n<custom>\n\`\`\`\n\n${deep}`,

      // Container exits onto tables, blockquote + HTML Types 3/4/5, 4-space indented bullet, and container HTML/list boundaries
      `1.\n| \`a|b\` | c |\n| --- | --- |\n~~~~~\n${deep}`,
      `- [ ] a\n| \`a|b\` | c |\n| --- | --- |\n~~~~~\n${deep}`,
      `- a\n\n| a | b |\n| --- | --- |\n\t \n<custom>\n\`\`\`\n\n${deep}`,
      `> a\n<?xml?>${'- '.repeat(5000)}x`,
      `> 1. a\n> > - a\n<!a>${deep}`,
      `> - a\n<DIV>\n> - b\ni. a\r> 1. a\n> > - a\n<!a>${'  > '.repeat(3500)}x`,
      `para\n> a\n<!DOCTYPE > ${deep}`,
      `    - a\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`ts\n${deep}`,
      `- a\n</foo\n</foo\t\n>\n<!DOCTYPE ${deep}`,
      `| a | b |\n| --- | --- |\n1.\n</foo\n\t\n>\n\`\`\`\t\n\n\`\`\`\`\n${deep}`,
      `- a\n<precustom>\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`\n${deep}`,
      `- a\n<!-- x -->\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`\n${deep}`,
      `- a\n\`\`\`a\`b\n| \`a|b\` | c |\n| --- | --- |\n\`\`\`\n${deep}`,
      `1. a\n<div>\n- [ ] a\n[a]:\n\`\`\`\n${deep}`,
      `1000. a\n\n     <pre>\n[a]:\n\`\`\`\n${deep}`
    ]
    for (const markdown of cases) {
      expect(() => parseMarkdown(markdown)).toThrow(MarkdownTooDeepError)
    }
  })

  test('bounds HTML attribute, table backtick, mid-line task, and link-definition scans to O(n)', () => {
    const origIndexOf = String.prototype.indexOf
    let scanned = 0
    String.prototype.indexOf = function (search: string, pos?: number) {
      const from = Math.max(0, pos ?? 0)
      const idx = origIndexOf.call(this, search, from)
      scanned += (idx === -1 ? this.length : idx) - from
      return idx
    }
    try {
      const backtickHeader = `| ${Array.from({ length: 405 }, (_, k) => '`'.repeat(k + 1)).join(' ')} \`a|b\` | x |\n| --- | --- |\n\`\`\`\n\`\`\`\n\`\`\`\n`
      for (const prefix of [
        '<x a="\n'.repeat(4000),
        '[a]: <\n'.repeat(4000),
        backtickHeader,
        'x- [ ] a\n'.repeat(8000)
      ]) {
        scanned = 0
        const md = `${prefix}${'> '.repeat(33)}hi`
        expect(() => parseMarkdown(md)).toThrow(MarkdownTooDeepError)
        expect(scanned).toBe(0)
      }
    } finally {
      String.prototype.indexOf = origIndexOf
    }
  })

  test('wrapStrayInlineNodes wraps a stray inline image at 5000-level depth iteratively', () => {
    let node: Record<string, unknown> = {
      type: 'image',
      attrs: { src: 'https://example.test/p.png', alt: 'deep' }
    }
    for (let i = 0; i < 5000; i += 1) {
      node = { type: 'blockquote', content: [node] }
    }

    const wrapped = wrapStrayInlineNodes({ type: 'doc', content: [node] })
    let cursor = wrapped.content[0] as Record<string, unknown>
    for (let i = 0; i < 5000; i += 1) {
      expect(cursor.type).toBe('blockquote')
      cursor = (cursor.content as Record<string, unknown>[])[0]!
    }
    expect(cursor.type).toBe('paragraph')
    expect((cursor.content as Record<string, unknown>[])[0]?.type).toBe('image')
  })
})
