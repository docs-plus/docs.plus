import { parseDocTitlePayload, plainTitle } from './titleWrite'

describe('titleWrite', () => {
  it('strips tags and keeps the text', () => {
    expect(plainTitle('<img src=x onerror=alert(1)>Hello')).toBe('Hello')
    expect(plainTitle('  plain  ')).toBe('  plain  ')
  })

  it('parses a docTitle relay and strips the title', () => {
    expect(
      parseDocTitlePayload(JSON.stringify({ type: 'docTitle', state: { title: '<b>Hi</b>' } }))
    ).toBe('Hi')
    expect(
      parseDocTitlePayload(JSON.stringify({ type: 'private', state: { title: 'x' } }))
    ).toBeNull()
    expect(parseDocTitlePayload('not-json')).toBeNull()
  })
})
