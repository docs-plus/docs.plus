import * as toast from '@components/toast'
import { useAuthStore } from '@stores'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'

import ImportExportSection from './ImportExportSection'

jest.mock('@utils/openInlineSignInDialog', () => ({
  openInlineSignInDialog: jest.fn()
}))

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

const renderSection = (
  overrides: Partial<React.ComponentProps<typeof ImportExportSection>> = {}
) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ImportExportSection
        editor={null}
        documentId="doc-1"
        documentSlug="my-pad"
        documentTitle="My Pad"
        editingLocked={false}
        isOwner={false}
        isPrivate={false}
        userId="u1"
        isSheet={false}
        onPrint={jest.fn()}
        {...overrides}
      />
    </QueryClientProvider>
  )
}

describe('ImportExportSection Duplicate action', () => {
  const realFetch = global.fetch
  const realRestApiUrl = process.env.NEXT_PUBLIC_RESTAPI_URL
  const initialAuthState = useAuthStore.getState()

  beforeEach(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = 'http://rest.test/api'
    jest.clearAllMocks()
    useAuthStore.setState({
      loading: false,
      profile: { id: 'u1' } as typeof initialAuthState.profile,
      session: { id: 'u1' } as typeof initialAuthState.session
    })
  })

  afterEach(() => {
    global.fetch = realFetch
    process.env.NEXT_PUBLIC_RESTAPI_URL = realRestApiUrl
    useAuthStore.setState(initialAuthState)
  })

  it('shows Duplicate enabled on non-owned readable read-only pads', () => {
    renderSection({ isOwner: false, isPrivate: false, editingLocked: true })

    const duplicateButton = screen.getByRole('button', { name: /Duplicate/ })
    expect(duplicateButton).toBeEnabled()
    expect(screen.getByText('This document is read-only, so it can’t be replaced.')).toBeVisible()
  })

  it('hides Duplicate on non-owned private pads', () => {
    renderSection({ isOwner: false, isPrivate: true })

    expect(screen.queryByRole('button', { name: /Duplicate/ })).not.toBeInTheDocument()
  })

  it('prompts visitor sign-in synchronously without sending fetch', () => {
    useAuthStore.setState({ loading: false, profile: null, session: null })
    const fetchSpy = jest.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    renderSection({ userId: undefined })
    fireEvent.click(screen.getByRole('button', { name: /Duplicate/ }))

    expect(openInlineSignInDialog).toHaveBeenCalledTimes(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('falls back to documentSlug when documentTitle is empty', async () => {
    const fetchSpy = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            success: true,
            data: { documentId: 'copy-1', slug: 'copy-1', title: 'my-pad' }
          })
        }) as Response
    )
    global.fetch = fetchSpy as unknown as typeof fetch

    renderSection({ documentTitle: '', documentSlug: 'my-pad' })
    fireEvent.click(screen.getByRole('button', { name: /Duplicate/ }))

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://rest.test/api/documents/doc-1/duplicate',
        expect.objectContaining({ method: 'POST' })
      )
    )
    await waitFor(() =>
      expect(toast.Success).toHaveBeenCalledWith(
        'Copy of “my-pad” created',
        expect.objectContaining({ id: 'toast-1' })
      )
    )
  })
})
