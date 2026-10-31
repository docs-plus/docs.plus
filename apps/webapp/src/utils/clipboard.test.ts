import { readable } from './clipboard'

const ORIGIN = 'https://app.test'

describe('readable', () => {
  it('shows the > trail and keeps every escape that would end or split a pasted link', () => {
    expect(readable(`${ORIGIN}/doc?h=a%3Eb%3ec&id=x`)).toBe(`${ORIGIN}/doc?h=a>b>c&id=x`)
    expect(readable(`${ORIGIN}/doc/a%20b?q=%26%3D%23`)).toBe(`${ORIGIN}/doc/a%20b?q=%26%3D%23`)
  })
})
