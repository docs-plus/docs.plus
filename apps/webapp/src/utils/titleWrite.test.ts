import { fetchDocument } from '@utils/fetchDocument'

import { onDocTitleStateless, plainTitle, REFETCH_GAP_MS } from './titleWrite'

jest.mock('@utils/fetchDocument', () => ({ fetchDocument: jest.fn() }))
jest.mock('@utils/supabase', () => ({
  supabaseClient: { auth: { getSession: async () => ({ data: { session: null } }) } }
}))
jest.mock('@stores', () => ({
  useStore: {
    getState: () => ({
      settings: { metadata: { documentId: 'd1', slug: 's1', title: 'Old' } },
      setWorkspaceSetting: jest.fn()
    })
  }
}))

const fetchDocumentMock = fetchDocument as jest.Mock

describe('titleWrite', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('strips tags and keeps the text', () => {
    expect(plainTitle('<img src=x onerror=alert(1)>Hello')).toBe('Hello')
    expect(plainTitle('  plain  ')).toBe('  plain  ')
  })

  it('folds a burst during one GET into one rerun after the gap', async () => {
    jest.useFakeTimers()
    const pending: Array<(doc: { documentId: string; title: string }) => void> = []
    fetchDocumentMock.mockImplementation(() => new Promise((resolve) => pending.push(resolve)))

    onDocTitleStateless()
    await jest.advanceTimersByTimeAsync(0)
    expect(fetchDocumentMock).toHaveBeenCalledTimes(1)

    onDocTitleStateless()
    onDocTitleStateless()
    pending[0]({ documentId: 'd1', title: 'Real' })
    await jest.advanceTimersByTimeAsync(REFETCH_GAP_MS - 1)
    expect(fetchDocumentMock).toHaveBeenCalledTimes(1)

    await jest.advanceTimersByTimeAsync(1)
    expect(fetchDocumentMock).toHaveBeenCalledTimes(2)

    pending[1]({ documentId: 'd1', title: 'Real' })
    await jest.advanceTimersByTimeAsync(REFETCH_GAP_MS * 2)
    expect(fetchDocumentMock).toHaveBeenCalledTimes(2)
  })
})
