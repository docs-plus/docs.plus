import { getSiteIconUrl } from './link-helpers'

describe('getSiteIconUrl', () => {
  const API = 'https://api.example/api'
  const saved = process.env.NEXT_PUBLIC_RESTAPI_URL
  beforeAll(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = API
  })
  afterAll(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = saved
  })

  it('asks the icon route with the origin only', () => {
    expect(getSiteIconUrl('https://github.com/docs-plus/docs.plus/pull/1?x=1#y')).toBe(
      `${API}/metadata/icon?origin=${encodeURIComponent('https://github.com')}`
    )
  })

  it('gives a mailto: link no icon URL, though it parses as user mailto at a host', () => {
    expect(getSiteIconUrl('mailto:a@b.c')).toBeUndefined()
  })
})
