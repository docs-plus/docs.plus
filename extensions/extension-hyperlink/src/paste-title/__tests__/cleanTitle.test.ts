import { describe, expect, it } from 'bun:test'

import { cleanTitle } from '../cleanTitle'

const LINK = { text: 'https://example.com/a', href: 'https://example.com/a' }
const LONG = 'a'.repeat(130)

// Every host gets this title through the same cleaner, so its table pins the safety rules.
const CASES: Array<[name: string, raw: string, expected: string | null]> = [
  ['keeps a plain title', 'Example Domain', 'Example Domain'],
  ['trims the ends', '  Example Domain \n', 'Example Domain'],
  ['collapses whitespace runs', 'Example \t\t  Domain', 'Example Domain'],
  ['turns a newline into a space', 'Example\nDomain', 'Example Domain'],
  ['turns a tab into a space', 'Example\tDomain', 'Example Domain'],
  ['strips a NUL', 'Exam\u0000ple', 'Example'],
  ['strips a C1 control', 'Exam\u0085ple', 'Example'],
  ['strips DEL', 'Exam\u007fple', 'Example'],
  ['strips a right-to-left override', 'evil\u202Etxt.exe', 'eviltxt.exe'],
  ['strips the isolates', '\u2066a\u2067b\u2068c\u2069', 'abc'],
  ['strips the bidi marks', '\u200Eleft\u200F', 'left'],
  ['strips the Arabic letter mark', 'Exam\u061Cple', 'Example'],
  ['collapses the gap a stripped control leaves', 'a \u202E b', 'a b'],
  ['keeps a title of 120 graphemes', 'a'.repeat(120), 'a'.repeat(120)],
  ['cuts a longer title to 120 graphemes and adds an ellipsis', LONG, `${'a'.repeat(120)}…`],
  ['counts an emoji family as one grapheme', '👨‍👩‍👧'.repeat(121), `${'👨‍👩‍👧'.repeat(120)}…`],
  ['drops a space before the ellipsis', `${'a'.repeat(119)} bbb`, `${'a'.repeat(119)}…`],
  ['skips an empty title', '', null],
  ['skips a whitespace-only title', ' \n\t ', null],
  ['skips a title of controls only', '\u202E\u0000', null],
  ['skips a title of invisible characters only', '\u200B\u200D\u2060', null],
  ['skips a title equal to the URL text', 'https://example.com/a', null],
  ['skips a title equal to the href', ' https://example.com/a ', null],
  ['skips a bare hostname of another site', 'paypal.com', null],
  ['skips a full URL of another site', 'https://paypal.com/login', null],
  ['keeps a bare hostname of the same site', 'example.com', 'example.com'],
  ['keeps the same site with www.', 'www.example.com', 'www.example.com'],
  [
    'keeps a title that only mentions a host',
    'Pay with paypal.com today',
    'Pay with paypal.com today'
  ]
]

describe('cleanTitle', () => {
  for (const [name, raw, expected] of CASES) {
    it(name, () => {
      expect(cleanTitle(raw, LINK)).toBe(expected)
    })
  }

  it.each([
    ['https://files.example.com/x/archive.zip', 'archive.zip'],
    ['https://files.example.com/x/README.md', 'README.md'],
    ['https://files.example.com/x/clip.mov', 'clip.mov'],
    ['https://files.example.com/x/my%20script.py', 'my script.py']
  ])("keeps the link's own file name when it reads as a domain: %s", (href, name) => {
    expect(cleanTitle(name, { text: href, href })).toBe(name)
  })

  it('skips a domain-like file name that is not the link’s own', () => {
    const href = 'https://files.example.com/x/archive.zip'
    expect(cleanTitle('setup.zip', { text: href, href })).toBeNull()
    expect(cleanTitle('paypal.com', { text: href, href })).toBeNull()
  })

  it.each([
    ['https://evil.example/x/paypal.com%2Flogin.zip', 'paypal.com/login.zip'],
    ['https://evil.example/x/paypal.com.zip', 'paypal.com.zip'],
    ['https://evil.example/x/https%3A%2F%2Fpaypal.com%2Fa.zip', 'https://paypal.com/a.zip']
  ])('skips an own file name that reads as another site: %s', (href, name) => {
    expect(cleanTitle(name, { text: href, href })).toBeNull()
  })

  it('skips a page whose own path names another site', () => {
    const href = 'https://evil.example/paypal.com'
    expect(cleanTitle('paypal.com', { text: href, href })).toBeNull()
  })

  it('compares the URL text and the href apart', () => {
    const bare = { text: 'example.com', href: 'https://example.com' }
    expect(cleanTitle('example.com', bare)).toBeNull()
    expect(cleanTitle('https://example.com', bare)).toBeNull()
  })
})
