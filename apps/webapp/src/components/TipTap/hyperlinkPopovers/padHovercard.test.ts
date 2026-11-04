import type { HovercardRenderContext } from '@docs.plus/extension-hyperlink'
import { render } from '@testing-library/react'
import type { Editor } from '@tiptap/core'
import { createElement } from 'react'

import { HovercardPortal } from './HovercardPortal'
import { padHovercard } from './padHovercard'

jest.mock('@stores', () => ({ linkPreviewOn: () => true }))
// It loads the Supabase client, which needs env vars; a web link never calls it.
jest.mock('./padLinkCard/loadCard', () => ({ loadCardView: jest.fn() }))

const API = 'http://api.test/api'
const fetchMock = jest.fn()

const reply = (status: number, body: unknown) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

const hover = (href: string) => padHovercard.fetchMetadata({ href, editor: {} as Editor })

beforeAll(() => {
  process.env.NEXT_PUBLIC_RESTAPI_URL = API
  global.fetch = fetchMock as unknown as typeof fetch
  // AbortSignal.timeout is missing in jsdom.
  AbortSignal.timeout ??= () => new AbortController().signal
  window.history.pushState({}, '', '/current-pad')
})

beforeEach(() => fetchMock.mockReset())

describe('padHovercard.fetchMetadata, a web page', () => {
  test('the fallback card maps to no title, so render picks the no-preview card', async () => {
    fetchMock.mockReturnValue(
      reply(200, { success: true, url: 'https://a.example/', title: 'a.example', fallback: true })
    )

    expect(await hover('https://a.example/')).toEqual({})
  })

  test('the fallback card passes a known miss and drops an unknown one', async () => {
    const fallback = (url: string, miss: string) =>
      reply(200, { success: true, url, title: 'host', fallback: true, miss })
    fetchMock.mockReturnValueOnce(fallback('https://b.example/', 'blocked'))
    fetchMock.mockReturnValueOnce(fallback('https://c.example/', 'paywall'))

    expect(await hover('https://b.example/')).toEqual({ miss: 'blocked' })
    expect(await hover('https://c.example/')).toEqual({})
  })

  // A path such as GitHub's `blob/main/report.pdf` is a page; only a miss makes it a file.
  test('a file link with a real card draws the web card, and with none the file card', async () => {
    render(createElement(HovercardPortal))
    const cardText = async (href: string, body: unknown) => {
      fetchMock.mockReturnValueOnce(reply(200, body))
      const data = await hover(href)
      const ctx = { href, link: document.createElement('a'), state: 'data', data }
      const view = padHovercard.render(ctx as HovercardRenderContext<NonNullable<typeof data>>)
      return view.element.textContent
    }

    const page = 'https://github.com/o/r/blob/main/report.pdf'
    const real = await cardText(page, { success: true, url: page, title: 'report.pdf at main' })
    expect(real).toContain('report.pdf at main')
    expect(real).not.toContain('A PDF file')

    const file = 'https://e.example/report.pdf'
    const none = await cardText(file, {
      success: true,
      url: file,
      title: 'e.example',
      fallback: true
    })
    expect(none).toContain('A PDF file. Open it to read it.')

    // A non-HTML reply carries only the file name, so it is no preview either.
    const named = await cardText('https://e.example/named.pdf', {
      success: true,
      url: 'https://e.example/named.pdf',
      title: 'named.pdf',
      media_type: 'document'
    })
    expect(named).toContain('A PDF file. Open it to read it.')
  })

  test('a repo passes kind and the first three known facts', async () => {
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
        { icon: 'updated', text: 'today' }
      ]
    })
  })
})
