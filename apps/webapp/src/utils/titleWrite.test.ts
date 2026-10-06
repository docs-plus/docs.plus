import { fetchDocument } from '@utils/fetchDocument'

import { onDocTitleStateless, plainTitle } from './titleWrite'

const setWorkspaceSetting = jest.fn()

jest.mock('@utils/fetchDocument', () => ({ fetchDocument: jest.fn() }))
jest.mock('@utils/supabase', () => ({
  supabaseClient: { auth: { getSession: async () => ({ data: { session: null } }) } }
}))
jest.mock('@stores', () => ({
  useStore: {
    getState: () => ({
      settings: { metadata: { documentId: 'd1', slug: 's1', title: 'Old' } },
      setWorkspaceSetting
    })
  }
}))

const fetchDocumentMock = fetchDocument as jest.Mock
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('titleWrite', () => {
  beforeEach(() => {
    fetchDocumentMock.mockReset()
    setWorkspaceSetting.mockReset()
  })

  it('strips tags and keeps the text', () => {
    expect(plainTitle('<img src=x onerror=alert(1)>Hello')).toBe('Hello')
    expect(plainTitle('  plain  ')).toBe('  plain  ')
  })

  it('applies the REST title, never the relayed text', async () => {
    fetchDocumentMock.mockResolvedValue({ documentId: 'd1', title: 'Real' })
    onDocTitleStateless(JSON.stringify({ type: 'docTitle', state: { title: 'fake' } }))
    await flush()

    expect(fetchDocumentMock).toHaveBeenCalledWith('s1', null)
    expect(setWorkspaceSetting).toHaveBeenCalledWith(
      'metadata',
      expect.objectContaining({ title: 'Real' })
    )
  })

  it('ignores other stateless messages', async () => {
    onDocTitleStateless(JSON.stringify({ type: 'private', state: { title: 'x' } }))
    onDocTitleStateless('not-json')
    await flush()

    expect(fetchDocumentMock).not.toHaveBeenCalled()
  })
})
