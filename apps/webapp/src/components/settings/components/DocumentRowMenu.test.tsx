import { useSheetStore, useStore } from '@stores'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'

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

const renderSheet = (override: Partial<DocumentRowMenuProps> = {}) => {
  const merged: DocumentRowMenuProps = {
    ...props,
    ...override,
    doc: { ...props.doc, ...override.doc }
  }
  useSheetStore.getState().openSheet('documentRowMenu', merged)
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <DocumentRowMenuSheet {...merged} />
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

describe('DocumentRowMenuSheet ownership and Duplicate gating', () => {
  afterEach(() => {
    useSheetStore.getState().closeSheet()
  })

  it('exposes Duplicate on non-owned non-private read-only rows without leaking owner controls', () => {
    renderSheet({ isOwner: false, doc: { ...props.doc, isPrivate: false, readOnly: true } })

    expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Favorite/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Private' })).not.toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Read-only' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('hides Copy link and Duplicate on non-owned private rows', () => {
    renderSheet({ isOwner: false, doc: { ...props.doc, isPrivate: true } })

    expect(screen.getByRole('button', { name: 'Open in new tab' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Duplicate' })).not.toBeInTheDocument()
  })

  it('keeps Duplicate alongside owner controls on owned private rows', () => {
    renderSheet({ isOwner: true, doc: { ...props.doc, isPrivate: true } })

    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
