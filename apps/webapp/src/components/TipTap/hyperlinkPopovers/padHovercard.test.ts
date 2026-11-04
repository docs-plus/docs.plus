import { padHovercard } from './padHovercard'

jest.mock('@stores', () => ({
  authStore: { getState: () => ({}) },
  selectIsSignedIn: () => false,
  useLinkPreviewStore: { getState: () => ({ showOnHover: true }) }
}))
jest.mock('./previewShared', () => ({ createSiteIcon: () => null }))

const API = 'http://api.test/api'
const fetchMock = jest.fn()

const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

const hover = (href: string) => padHovercard.fetchMetadata({ href })

beforeAll(() => {
  process.env.NEXT_PUBLIC_RESTAPI_URL = API
  global.fetch = fetchMock as unknown as typeof fetch
  // AbortSignal.timeout is missing in jsdom.
  AbortSignal.timeout ??= () => new AbortController().signal
  window.history.pushState({}, '', '/current-pad')
})

beforeEach(() => fetchMock.mockReset())

describe('padHovercard.fetchMetadata, a web page', () => {
  test('the fallback card has no title, so the card shows the no-preview line', async () => {
    fetchMock.mockReturnValue(
      reply(200, { success: true, url: 'https://a.example/', title: 'a.example', fallback: true })
    )

    expect(await hover('https://a.example/')).toEqual({})
  })

  test('a repo passes kind and only the known facts; the extension caps the count', async () => {
    fetchMock.mockReturnValue(
      reply(200, {
        success: true,
        url: 'https://github.com/o/r',
        title: 'o/r',
        description: 'A repo',
        kind: 'repo',
        facts: [
          { icon: 'stars', text: '12' },
          { icon: 'rocket', text: 'unknown icon' },
          { icon: 'constructor', text: 'not an own key' },
          { icon: 'language', text: '' },
          { icon: 'language', text: 'Rust' },
          { icon: 'updated', text: 'today' },
          { icon: 'answers', text: 'fourth known' }
        ]
      })
    )

    expect(await hover('https://github.com/o/r')).toEqual({
      title: 'o/r',
      description: 'A repo',
      image: undefined,
      kind: 'repo',
      facts: [
        { icon: 'stars', text: '12' },
        { icon: 'language', text: 'Rust' },
        { icon: 'updated', text: 'today' },
        { icon: 'answers', text: 'fourth known' }
      ]
    })
  })
})
