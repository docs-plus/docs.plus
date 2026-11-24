import { DocumentFetchError } from '@utils/fetchDocument'

import { fetchDocumentMarkdown, prefersMarkdownAccept } from './acceptMarkdown'

describe('prefersMarkdownAccept', () => {
  it.each([
    'text/markdown',
    'text/markdown, text/html;q=0.8',
    'text/html;q=0.8, text/markdown',
    'text/markdown;q=0.9, text/html;q=0.8',
    'text/markdown; charset=utf-8; q=0.9, text/html; q=0.5',
    'TEXT/MARKDOWN;Q=0.9, TEXT/HTML;Q=0.8',
    'text/html;q=0, text/markdown;q=0.5',
    'text/markdown; foo="a,b"; q=0.9, text/html; q=0.5',
    ['text/markdown;q=0.9', 'text/html;q=0.5']
  ])('returns true when text/markdown strictly outranks text/html: %p', (header) => {
    expect(prefersMarkdownAccept(header)).toBe(true)
  })

  it.each([
    undefined,
    '',
    '   ',
    '*/*',
    'text/*',
    'text/html,application/xhtml+xml,*/*;q=0.8',
    'text/html, text/markdown',
    'text/html;q=0.9, text/markdown;q=0.9',
    'text/html, text/markdown;q=0.9',
    'text/markdown;q=0',
    'text/markdown;q=0.000',
    'text/markdown;q=0, text/markdown;q=0.9',
    'text/markdown;q=1.5',
    'text/markdown;q=-0.1',
    'text/markdown;q=0.1234',
    'text/markdown;q=abc',
    'text/markdown;q=',
    'text/markdown;q=0.8;q=0.9'
  ])('returns false for wildcards, ties, q=0, or invalid q-values: %p', (header) => {
    expect(prefersMarkdownAccept(header)).toBe(false)
  })
})

describe('fetchDocumentMarkdown', () => {
  const realFetch = global.fetch
  const realServerUrl = process.env.SERVER_RESTAPI_URL
  const realPublicUrl = process.env.NEXT_PUBLIC_RESTAPI_URL

  beforeEach(() => {
    process.env.SERVER_RESTAPI_URL = 'http://rest-api:4000/api/'
    process.env.NEXT_PUBLIC_RESTAPI_URL = 'https://public.test/api'
  })

  afterEach(() => {
    global.fetch = realFetch
    if (realServerUrl === undefined) delete process.env.SERVER_RESTAPI_URL
    else process.env.SERVER_RESTAPI_URL = realServerUrl
    if (realPublicUrl === undefined) delete process.env.NEXT_PUBLIC_RESTAPI_URL
    else process.env.NEXT_PUBLIC_RESTAPI_URL = realPublicUrl
  })

  it('prefers SERVER_RESTAPI_URL, forwards client IP headers, and never sends cookies/auth', async () => {
    const fetchSpy = jest.fn(
      async () =>
        ({
          status: 200,
          text: async () => '# Hello\n'
        }) as Response
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    const result = await fetchDocumentMarkdown('my doc', {
      realIp: '203.0.113.5',
      forwardedFor: '203.0.113.5, 10.0.0.1'
    })

    expect(result).toEqual({ status: 200, body: '# Hello\n' })
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://rest-api:4000/api/documents/my%20doc/markdown',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'text/markdown',
          'x-real-ip': '203.0.113.5',
          'x-forwarded-for': '203.0.113.5, 10.0.0.1'
        }
      })
    )
  })

  it('maps 404, 413, and 429 with Retry-After, and throws DocumentFetchError on 500 or network failure', async () => {
    global.fetch = jest.fn(
      async () =>
        ({ status: 404, body: { cancel: jest.fn(async () => {}) } }) as unknown as Response
    ) as unknown as typeof fetch
    expect(await fetchDocumentMarkdown('missing')).toEqual({ status: 404, body: '' })

    global.fetch = jest.fn(
      async () =>
        ({ status: 413, body: { cancel: jest.fn(async () => {}) } }) as unknown as Response
    ) as unknown as typeof fetch
    expect(await fetchDocumentMarkdown('huge')).toEqual({ status: 413, body: '' })

    global.fetch = jest.fn(
      async () =>
        ({
          status: 429,
          headers: new Headers({ 'retry-after': '60' }),
          body: { cancel: jest.fn(async () => {}) }
        }) as unknown as Response
    ) as unknown as typeof fetch
    expect(await fetchDocumentMarkdown('hot')).toEqual({
      status: 429,
      body: '',
      retryAfter: '60'
    })

    global.fetch = jest.fn(
      async () =>
        ({ status: 500, body: { cancel: jest.fn(async () => {}) } }) as unknown as Response
    ) as unknown as typeof fetch
    await expect(fetchDocumentMarkdown('err')).rejects.toMatchObject({
      name: 'DocumentFetchError',
      status: 500
    })

    global.fetch = jest.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    await expect(fetchDocumentMarkdown('down')).rejects.toBeInstanceOf(DocumentFetchError)
  })
})
