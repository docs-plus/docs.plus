import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { makeDocumentsKey } from '../documentsQueryKey'
import type { DocumentsPage, OwnedDocument } from '../types'
import { useOwnerDocumentsCache, useTrashCache } from './documentsCache'
import { useTrashedDocuments } from './useTrashedDocuments'

jest.mock('@utils/supabase', () => ({
  supabaseClient: { auth: { getSession: async () => ({ data: { session: null } }) } }
}))

const scope = { userId: 'u1', searchQuery: '', sortKey: 'lastOpenedAt_desc' } as const
const key = makeDocumentsKey(scope)

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

const wrapperFor = (client: QueryClient) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return Wrapper
}

const mount = (seed?: { pages: DocumentsPage[]; pageParams: number[] }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (seed) client.setQueryData(key, seed)
  const { result } = renderHook(() => useOwnerDocumentsCache(scope), {
    wrapper: wrapperFor(client)
  })
  return { client, cache: result.current }
}

// The seeded pageParams are row offsets, matching what DocumentsSection now stores.
const onePage = { pages: [{ total: 45, docs: [doc('a'), doc('b')] }], pageParams: [0] }

describe('useOwnerDocumentsCache', () => {
  // A copy has no `lastOpenedAt`, so the server sorts it last and it can land past the
  // loaded window. Patching it near the top made the row flash and vanish on the refetch.
  it('marks the list stale for a duplicate and patches nothing', async () => {
    const { client, cache } = mount(onePage)

    await act(async () => cache.addDuplicate())

    const docs = client.getQueryData<typeof onePage>(key)!.pages[0].docs
    expect(docs.map((d) => d.documentId)).toEqual(['a', 'b'])
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it('leaves a removal patched, because the row left the server list too', async () => {
    const { client, cache } = mount(onePage)

    await act(async () => {
      await cache.removeDocument('a')
    })

    expect(
      client.getQueryData<typeof onePage>(key)!.pages[0].docs.map((d) => d.documentId)
    ).toEqual(['b'])
    expect(client.getQueryState(key)?.isInvalidated).toBe(false)
  })

  it('rolls a failed removal back to the list it started from', async () => {
    const { client, cache } = mount(onePage)

    await act(async () => {
      const outcome = await cache.removeDocument('a')
      outcome!.rollback()
    })

    expect(
      client.getQueryData<typeof onePage>(key)!.pages[0].docs.map((d) => d.documentId)
    ).toEqual(['a', 'b'])
  })

  it('answers null when the list holds nothing yet, so no caller writes a phantom row', async () => {
    const { cache } = mount()

    await act(async () => {
      expect(await cache.removeDocument('a')).toBeNull()
      expect(await cache.patchDocument('a', { title: 'x' })).toBeNull()
    })
  })
})

// One paging rule for the whole feature: Trash pages by row offset, like the Owner live
// list. A page index would ask for offset 20 after a removal and skip one document.
describe('useTrashedDocuments paging', () => {
  const restApiUrl = process.env.NEXT_PUBLIC_RESTAPI_URL
  const realFetch = global.fetch

  beforeAll(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = 'http://rest.test'
  })

  afterAll(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = restApiUrl
    global.fetch = realFetch
  })

  const mountTrash = (asked: number[]) => {
    global.fetch = jest.fn(async (url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset'))
      asked.push(offset)
      const docs = Array.from({ length: 20 }, (_, i) => doc(`t${offset + i}`))
      return { ok: true, json: async () => ({ data: { total: 45, docs } }) }
    }) as unknown as typeof fetch

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return renderHook(() => ({ list: useTrashedDocuments('u1'), cache: useTrashCache('u1') }), {
      wrapper: wrapperFor(client)
    })
  }

  it('asks Load more for the rows it still holds after an optimistic removal', async () => {
    const asked: number[] = []
    const { result } = mountTrash(asked)
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))

    await act(async () => {
      await result.current.cache.removeDocuments(['t5'])
    })
    await act(async () => {
      await result.current.list.fetchNextPage()
    })

    expect(asked).toEqual([0, 19])
  })
})
