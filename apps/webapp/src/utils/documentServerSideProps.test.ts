import { fetchDocument } from '@utils/fetchDocument'
import { captureGsspDocumentError } from '@utils/observability'
import { createClient } from '@utils/supabase/server-props'
import type { GetServerSidePropsContext } from 'next'

import { documentServerSideProps } from './documentServerSideProps'

const mockGetUser = jest.fn(async () => ({ data: { user: null }, error: null }))
const mockGetSession = jest.fn(async () => ({ data: { session: null } }))

jest.mock('@utils/supabase/server-props', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...(args as [])),
      getSession: (...args: unknown[]) => mockGetSession(...(args as []))
    }
  }))
}))

jest.mock('@utils/fetchDocument', () => {
  const actual = jest.requireActual('@utils/fetchDocument')
  return {
    ...actual,
    fetchDocument: jest.fn()
  }
})

jest.mock('@utils/observability', () => ({
  captureGsspDocumentError: jest.fn()
}))

jest.mock('@utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}))

function createMockContext({
  slugs,
  headers = {},
  method = 'GET'
}: {
  slugs?: string[]
  headers?: Record<string, string | string[] | undefined>
  method?: string
}) {
  const responseHeaders = new Map<string, string | string[]>()
  let endedBody: string | undefined

  const res = {
    statusCode: 200,
    setHeader: jest.fn((name: string, value: string | string[]) => {
      responseHeaders.set(name.toLowerCase(), value)
    }),
    getHeader: jest.fn((name: string) => responseHeaders.get(name.toLowerCase())),
    end: jest.fn((chunk?: string) => {
      endedBody = chunk
    })
  }

  const context = {
    req: { headers, method },
    res,
    query: slugs ? { slugs } : {},
    resolvedUrl: slugs ? `/${slugs.join('/')}` : '/'
  } as unknown as GetServerSidePropsContext

  return {
    context,
    res,
    getHeader: (name: string) => responseHeaders.get(name.toLowerCase()),
    getEndedBody: () => endedBody
  }
}

describe('documentServerSideProps markdown negotiation', () => {
  const realFetch = global.fetch
  const realServerUrl = process.env.SERVER_RESTAPI_URL

  beforeEach(() => {
    process.env.SERVER_RESTAPI_URL = 'http://rest-api:4000/api'
    jest.clearAllMocks()
    ;(fetchDocument as jest.Mock).mockResolvedValue({
      documentId: 'doc-1',
      slug: 'my-pad',
      title: 'My Pad',
      isPrivate: false,
      keywords: [],
      docClientId: 'public.doc-1'
    })
  })

  afterEach(() => {
    global.fetch = realFetch
    if (realServerUrl === undefined) delete process.env.SERVER_RESTAPI_URL
    else process.env.SERVER_RESTAPI_URL = realServerUrl
  })

  it.each(['llms.txt', 'LLMS.TXT', 'api', 'new'])(
    'returns notFound for reserved slug %s even when Accept prefers text/markdown',
    async (reserved) => {
      const fetchSpy = jest.fn()
      global.fetch = fetchSpy as unknown as typeof fetch

      const { context, getHeader } = createMockContext({
        slugs: [reserved],
        headers: { accept: 'text/markdown' }
      })

      const result = await documentServerSideProps(context)
      expect(result).toEqual({ notFound: true })
      expect(getHeader('x-robots-tag')).toBe('noindex, nofollow')
      expect(fetchSpy).not.toHaveBeenCalled()
    }
  )

  it('skips markdown negotiation on x-nextjs-data transitions', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const { context, res, getHeader } = createMockContext({
      slugs: ['my-pad'],
      headers: { accept: 'text/markdown', 'x-nextjs-data': '1' }
    })

    const result = await documentServerSideProps(context)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(res.end).not.toHaveBeenCalled()
    expect(getHeader('vary')).toBeUndefined()
    expect(result).toMatchObject({ props: { docMetadata: { slug: 'my-pad' } } })
  })

  it('falls through to HTML SSR on multi-segment filter URLs and Accept ties', async () => {
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const multi = createMockContext({
      slugs: ['my-pad', 'filter'],
      headers: { accept: 'text/markdown' }
    })
    await documentServerSideProps(multi.context)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(multi.getHeader('vary')).toBe('Accept')

    const tie = createMockContext({
      slugs: ['my-pad'],
      headers: { accept: 'text/html;q=0.9, text/markdown;q=0.9' }
    })
    await documentServerSideProps(tie.context)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(tie.getHeader('vary')).toBe('Accept')
    expect(fetchDocument).toHaveBeenCalledTimes(2)
  })

  it('serves 200 text/markdown without running Supabase auth or fetchDocument', async () => {
    global.fetch = jest.fn(
      async () =>
        ({
          status: 200,
          text: async () => '# Heading\n\nBody\n'
        }) as Response
    ) as unknown as typeof fetch

    const { context, res, getHeader, getEndedBody } = createMockContext({
      slugs: ['my-pad'],
      headers: { accept: 'text/markdown', 'x-real-ip': '198.51.100.7' }
    })

    const result = await documentServerSideProps(context)

    expect(createClient).not.toHaveBeenCalled()
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(fetchDocument).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(getHeader('content-type')).toBe('text/markdown; charset=utf-8')
    expect(getHeader('vary')).toBe('Accept')
    expect(getHeader('x-robots-tag')).toBe('noindex, nofollow')
    expect(getHeader('cache-control')).toBe('no-store')
    expect(getEndedBody()).toBe('# Heading\n\nBody\n')
    expect(result).toEqual({ props: {} })
  })

  it('forwards 404, 413, and 429 (with Retry-After) fail-closed', async () => {
    global.fetch = jest.fn(
      async () =>
        ({ status: 404, body: { cancel: jest.fn(async () => {}) } }) as unknown as Response
    ) as unknown as typeof fetch
    const r404 = createMockContext({ slugs: ['secret'], headers: { accept: 'text/markdown' } })
    expect(await documentServerSideProps(r404.context)).toEqual({ props: {} })
    expect(r404.res.statusCode).toBe(404)
    expect(r404.getHeader('cache-control')).toBe('no-store')

    global.fetch = jest.fn(
      async () =>
        ({ status: 413, body: { cancel: jest.fn(async () => {}) } }) as unknown as Response
    ) as unknown as typeof fetch
    const r413 = createMockContext({ slugs: ['huge'], headers: { accept: 'text/markdown' } })
    expect(await documentServerSideProps(r413.context)).toEqual({ props: {} })
    expect(r413.res.statusCode).toBe(413)

    global.fetch = jest.fn(
      async () =>
        ({
          status: 429,
          headers: new Headers({ 'retry-after': '30' }),
          body: { cancel: jest.fn(async () => {}) }
        }) as unknown as Response
    ) as unknown as typeof fetch
    const r429 = createMockContext({ slugs: ['hot'], headers: { accept: 'text/markdown' } })
    expect(await documentServerSideProps(r429.context)).toEqual({ props: {} })
    expect(r429.res.statusCode).toBe(429)
    expect(r429.getHeader('retry-after')).toBe('30')
  })

  it('fails closed with 502/503 and reports error when markdown fetch fails unexpectedly', async () => {
    global.fetch = jest.fn(
      async () =>
        ({ status: 503, body: { cancel: jest.fn(async () => {}) } }) as unknown as Response
    ) as unknown as typeof fetch
    const r503 = createMockContext({ slugs: ['my-pad'], headers: { accept: 'text/markdown' } })
    expect(await documentServerSideProps(r503.context)).toEqual({ props: {} })
    expect(r503.res.statusCode).toBe(503)
    expect(fetchDocument).not.toHaveBeenCalled()
    expect(captureGsspDocumentError).toHaveBeenCalledTimes(1)

    global.fetch = jest.fn(async () => {
      throw new Error('ECONNRESET')
    }) as unknown as typeof fetch
    const r502 = createMockContext({ slugs: ['my-pad'], headers: { accept: 'text/markdown' } })
    expect(await documentServerSideProps(r502.context)).toEqual({ props: {} })
    expect(r502.res.statusCode).toBe(502)
    expect(fetchDocument).not.toHaveBeenCalled()
    expect(captureGsspDocumentError).toHaveBeenCalledTimes(2)
  })
})
