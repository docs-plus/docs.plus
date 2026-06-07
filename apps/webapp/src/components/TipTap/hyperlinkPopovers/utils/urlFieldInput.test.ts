import { containsUrlFieldWhitespace, mergeUrlPaste, stripUrlFieldWhitespace } from './urlFieldInput'

describe('urlFieldInput', () => {
  it('detects whitespace reliably across repeated probes', () => {
    expect(containsUrlFieldWhitespace('a\nb')).toBe(true)
    expect(containsUrlFieldWhitespace('\nleading')).toBe(true)
    expect(containsUrlFieldWhitespace('plain-url')).toBe(false)
  })

  it('strips and merges multiline paste at the caret', () => {
    expect(stripUrlFieldWhitespace('foo\nbar\tbaz')).toBe('foobarbaz')
    expect(mergeUrlPaste('https://a.com/', 'x\ny', 14, 14)).toEqual({
      next: 'https://a.com/xy',
      caret: 16
    })
    expect(mergeUrlPaste('https://a.com/', 'x\ny', null, null)).toEqual({
      next: 'https://a.com/xy',
      caret: 16
    })
  })
})
