import { useSheetStore, useStore } from '@stores'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'

import { DocumentRowMenuSheet, type DocumentRowMenuProps } from './DocumentRowMenu'

jest.mock('@utils/supabase', () => ({
  supabaseClient: { auth: { getSession: async () => ({ data: { session: null } }) } }
}))

const props: DocumentRowMenuProps = {
  doc: {
    documentId: 'd1',
    slug: 'd1',
    title: 'Doc',
    readOnly: false,
    isPrivate: false,
    isFavorite: false,
    updatedAt: '2026-09-01T00:00:00.000Z',
    createdAt: '2026-09-01T00:00:00.000Z'
  },
  scope: { userId: 'u1', scope: 'all', searchQuery: '', sortKey: 'updatedAt_desc' },
  isOwner: true
}

const openSheet = () => {
  useSheetStore.getState().openSheet('documentRowMenu', props)
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentRowMenuSheet {...props} />
    </QueryClientProvider>
  )
}

// Settings and the sheet both dismiss on a document keydown. Reaching it closes both.
describe('DocumentRowMenuSheet Escape', () => {
  const settingsDismiss = jest.fn()
  beforeEach(() => document.addEventListener('keydown', settingsDismiss))
  afterEach(() => {
    document.removeEventListener('keydown', settingsDismiss)
    settingsDismiss.mockClear()
    useStore.getState().closeDialog()
  })

  it('closes only the sheet, and never reaches the Settings dismiss', () => {
    openSheet()
    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(useSheetStore.getState().activeSheet).toBeNull()
    expect(settingsDismiss).not.toHaveBeenCalled()
  })

  it('keeps the sheet open while a confirm is open', () => {
    openSheet()
    useStore.getState().openDialog(null)
    fireEvent.keyDown(document.body, { key: 'Escape' })

    expect(useSheetStore.getState().activeSheet).toBe('documentRowMenu')
  })
})
