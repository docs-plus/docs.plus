import * as toast from '@components/toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import { makeDocumentsKey } from '../documentsQueryKey'
import type { DocumentsPage, OwnedDocument } from '../types'
import useDuplicateDocument, { duplicateErrorMessage } from './useDuplicateDocument'

jest.mock('@utils/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-1' } } })
    }
  }
}))

jest.mock('@components/toast', () => ({
  Loading: jest.fn(() => 'toast-1'),
  Success: jest.fn(),
  Error: jest.fn()
}))

const doc = (id: string): OwnedDocument => ({
  documentId: id,
  slug: id,
  title: id,
  readOnly: false,
  isPrivate: false,
  isFavorite: false,
  updatedAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z'
})

const scopeKey = makeDocumentsKey({
  userId: 'u1',
  scope: 'all',
  searchQuery: '',
  sortKey: 'lastOpenedAt_desc'
})

const seedPage: { pages: DocumentsPage[]; pageParams: number[] } = {
  pages: [{ total: 1, docs: [doc('d1')] }],
  pageParams: [0]
}

describe('duplicateErrorMessage', () => {
  it('formats 429 rate-limit messages with and without Retry-After', () => {
    expect(duplicateErrorMessage(429, 'RATE_LIMIT_EXCEEDED', '120')).toBe(
      'You’ve duplicated too many documents. Try again in 2 minutes.'
    )
    expect(duplicateErrorMessage(429, 'RATE_LIMIT_EXCEEDED', '45')).toBe(
      'You’ve duplicated too many documents. Try again in 45 seconds.'
    )
    expect(duplicateErrorMessage(429, 'RATE_LIMIT_EXCEEDED', null)).toBe(
      'You’ve duplicated too many documents. Try again in a few minutes.'
    )
    expect(duplicateErrorMessage(429, 'RATE_LIMIT_EXCEEDED', 'not-a-number')).toBe(
      'You’ve duplicated too many documents. Try again in a few minutes.'
    )
  })

  it('formats 503 busy messages with and without Retry-After', () => {
    expect(duplicateErrorMessage(503, 'SERVICE_UNAVAILABLE', '10')).toBe(
      'The server is busy right now. Try again in 10 seconds.'
    )
    expect(duplicateErrorMessage(503, 'SERVICE_UNAVAILABLE', null)).toBe(
      'The server is busy right now. Try again in a moment.'
    )
  })

  it('maps 401, 403, 404, 413, and unexpected statuses', () => {
    expect(duplicateErrorMessage(401)).toBe(
      'Your session has expired. Reload the page and sign in again.'
    )
    expect(duplicateErrorMessage(403)).toBe('You don’t have permission to duplicate this document.')
    expect(duplicateErrorMessage(404)).toBe('This document is no longer available.')
    expect(duplicateErrorMessage(413)).toBe('This document has too many media files to duplicate.')
    expect(duplicateErrorMessage(500)).toBe('Couldn’t duplicate document')
  })
})

describe('useDuplicateDocument', () => {
  const realFetch = global.fetch
  const realRestApiUrl = process.env.NEXT_PUBLIC_RESTAPI_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = 'http://rest.test/api'
    jest.clearAllMocks()
  })

  afterEach(() => {
    global.fetch = realFetch
    process.env.NEXT_PUBLIC_RESTAPI_URL = realRestApiUrl
  })

  const mount = (userId?: string) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(scopeKey, seedPage)
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    const hook = renderHook(() => useDuplicateDocument(userId), { wrapper })
    return { client, ...hook }
  }

  it('invalidates owner cache without patching on 200 and skips invalidation when userId is absent', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        success: true,
        data: { documentId: 'copy-1', slug: 'copy-1', title: 'Doc (copy)' }
      })
    })) as unknown as typeof fetch

    const signedIn = mount('u1')
    await act(async () => {
      signedIn.result.current.duplicate({ documentId: 'd1', name: 'Doc' })
    })

    expect(signedIn.client.getQueryState(scopeKey)?.isInvalidated).toBe(true)
    expect(
      signedIn.client
        .getQueryData<typeof seedPage>(scopeKey)
        ?.pages[0].docs.map((d) => d.documentId)
    ).toEqual(['d1'])
    expect(toast.Success).toHaveBeenCalledWith(
      'Copy of “Doc” created',
      expect.objectContaining({ id: 'toast-1', actionLabel: 'Open' })
    )

    const anon = mount(undefined)
    await act(async () => {
      anon.result.current.duplicate({ documentId: 'd1', name: 'Doc' })
    })
    expect(anon.client.getQueryState(scopeKey)?.isInvalidated).toBe(false)
  })

  it('surfaces mapped DuplicateError message to toast.Error on 429 and 503', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 429,
      headers: new Headers({ 'Retry-After': '120' }),
      json: async () => ({ error: { code: 'RATE_LIMIT_EXCEEDED' } })
    })) as unknown as typeof fetch

    const { result } = mount('u1')
    await act(async () => {
      result.current.duplicate({ documentId: 'd1', name: 'Doc' })
    })

    expect(toast.Error).toHaveBeenCalledWith(
      'You’ve duplicated too many documents. Try again in 2 minutes.',
      { id: 'toast-1' }
    )
  })
})
