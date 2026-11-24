import { useAuthStore, useStore } from '@stores'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'

import DocTitle from './DocTitle'

jest.mock('@utils/supabase', () => ({
  supabaseClient: {}
}))

jest.mock('@hooks/useUpdateDocMetadata', () => ({
  __esModule: true,
  default: () => ({
    isPending: false,
    isSuccess: false,
    mutate: jest.fn(),
    data: undefined
  })
}))

const renderDocTitle = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DocTitle />
    </QueryClientProvider>
  )

describe('DocTitle accessibility', () => {
  afterEach(() => {
    cleanup()
    useAuthStore.setState({ profile: null, session: null })
    useStore.getState().setWorkspaceSettings({
      metadata: {
        documentId: '',
        slug: '',
        title: '',
        ownerId: undefined
      } as never
    })
  })

  it('exposes textbox role, Pad title label, and aria-multiline=false when editable', () => {
    useAuthStore.setState({ profile: { id: 'owner-1' } as never, session: null })
    useStore.getState().setWorkspaceSettings({
      metadata: {
        documentId: 'doc-1',
        slug: 'doc-1',
        title: 'My Pad',
        ownerId: 'owner-1'
      } as never
    })

    renderDocTitle()

    const textbox = screen.getByRole('textbox', { name: 'Pad title' })
    expect(textbox).toHaveAttribute('aria-multiline', 'false')
    expect(textbox).toHaveAttribute('contenteditable', 'true')
  })

  it('omits textbox role, Pad title label, and aria-multiline when read-only', () => {
    useAuthStore.setState({ profile: { id: 'viewer-2' } as never, session: null })
    useStore.getState().setWorkspaceSettings({
      metadata: {
        documentId: 'doc-1',
        slug: 'doc-1',
        title: 'Locked Pad',
        ownerId: 'owner-1'
      } as never
    })

    renderDocTitle()

    expect(screen.queryByRole('textbox')).toBeNull()
    const titleEl = screen.getByText('Locked Pad')
    expect(titleEl).toHaveAttribute('contenteditable', 'false')
    expect(titleEl).not.toHaveAttribute('aria-label', 'Pad title')
    expect(titleEl).not.toHaveAttribute('aria-multiline')
  })
})
