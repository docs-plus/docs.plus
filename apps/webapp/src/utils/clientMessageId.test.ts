import { generateClientMessageId } from './clientMessageId'

describe('generateClientMessageId', () => {
  it('returns a string in UUID v4 shape', () => {
    const id = generateClientMessageId()
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('produces unique ids across rapid calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateClientMessageId()))
    expect(ids.size).toBe(1000)
  })
})
