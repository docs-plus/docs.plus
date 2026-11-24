import '@testing-library/jest-dom'

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { OAuthAuthorizationDetails, OAuthRedirect } from '@supabase/supabase-js'
import type { ReactNode } from 'react'

import { OAuthConsentContent } from './OAuthConsentContent'

AbortSignal.timeout ??= () => new AbortController().signal

const getAuthorizationDetails = jest.fn<
  Promise<{ data: OAuthAuthorizationDetails | OAuthRedirect | null; error: unknown }>,
  [string]
>()
const getSession = jest.fn<Promise<{ data: { session: { access_token: string } | null } }>, []>()
const approveAuthorization = jest.fn()
const denyAuthorization = jest.fn()

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true,
    query: { authorization_id: 'auth-req-1' },
    asPath: '/oauth/consent?authorization_id=auth-req-1',
    reload: jest.fn()
  })
}))

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}))

jest.mock('@stores', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({
      loading: false,
      session: { id: 'user-1', email: 'person@docs.plus' },
      profile: { id: 'user-1', username: 'person', avatar_url: null }
    })
}))

jest.mock('@components/ui/Avatar', () => ({
  Avatar: () => null
}))

jest.mock('@components/ui/GlobalDialog', () => ({
  GlobalDialog: () => null
}))

jest.mock('@utils/openInlineSignInDialog', () => ({
  openInlineSignInDialog: jest.fn()
}))

jest.mock('@utils/supabase', () => ({
  supabaseClient: {
    auth: {
      getSession: () => getSession(),
      oauth: {
        getAuthorizationDetails: (id: string) => getAuthorizationDetails(id),
        approveAuthorization: (...args: unknown[]) => approveAuthorization(...args),
        denyAuthorization: (...args: unknown[]) => denyAuthorization(...args)
      }
    }
  }
}))

const CLAUDE_URI = 'https://claude.ai/api/mcp/auth_callback'
const CHATGPT_URI = 'https://chatgpt.com/connector/oauth/abc-123'
const CURSOR_URI = 'https://www.cursor.com/agents/mcp/oauth/callback'
const LOCAL_URI = 'http://localhost:8787/callback'
const EVIL_URI = 'https://evil.example/cb'

const makeDetails = (redirectUri: string, clientName = 'Claude'): OAuthAuthorizationDetails => ({
  authorization_id: 'auth-req-1',
  redirect_uri: redirectUri,
  scope: 'openid email profile',
  client: {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: clientName,
    uri: '',
    logo_uri: ''
  },
  user: {
    id: 'user-1',
    email: 'person@docs.plus'
  }
})

describe('OAuthConsentContent', () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_RESTAPI_URL
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_RESTAPI_URL = 'https://api.docs.plus/api'
    getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-123' } } })
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_RESTAPI_URL = originalApiUrl
    global.fetch = originalFetch
  })

  it('waits for client redirects before leaving loading and downgrades mixed URIs without brand flash', async () => {
    let resolveFetch!: (res: Response) => void
    const pendingFetch = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    const fetchMock = jest.fn(() => pendingFetch)
    global.fetch = fetchMock as unknown as typeof fetch

    getAuthorizationDetails.mockResolvedValue({
      data: makeDetails(CLAUDE_URI, 'Claude'),
      error: null
    })

    render(<OAuthConsentContent navigate={jest.fn()} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.docs.plus/api/connected-apps/clients/550e8400-e29b-41d4-a716-446655440000/redirects',
      expect.objectContaining({ headers: { token: 'jwt-123' } })
    )
    expect(screen.queryByRole('button', { name: 'Allow' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Connect an app to docs.plus' })).toBeInTheDocument()

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          success: true,
          data: { redirects: [CLAUDE_URI, EVIL_URI] }
        })
      } as unknown as Response)
    })

    expect(await screen.findByText('Unverified app.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Allow “Claude” to use your docs.plus account?'
    )
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('https://claude.ai')
    expect(note).toHaveTextContent('https://evil.example')
  })

  it('fails closed with non-empty active origin when redirect lookup fails, returns 500, or is empty', async () => {
    getAuthorizationDetails.mockResolvedValue({
      data: makeDetails(CLAUDE_URI, 'Claude'),
      error: null
    })

    global.fetch = jest.fn(async () => {
      throw new Error('network error')
    }) as unknown as typeof fetch
    const first = render(<OAuthConsentContent navigate={jest.fn()} />)
    const firstNote = await first.findByRole('note')
    expect(firstNote).toHaveTextContent('Unverified app.')
    expect(firstNote).toHaveTextContent('It returns you to https://claude.ai.')
    first.unmount()

    global.fetch = jest.fn(
      async () => ({ ok: false, status: 500 }) as Response
    ) as unknown as typeof fetch
    const second = render(<OAuthConsentContent navigate={jest.fn()} />)
    const secondNote = await second.findByRole('note')
    expect(secondNote).toHaveTextContent('It returns you to https://claude.ai.')
    second.unmount()

    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ success: true, data: { redirects: [] } })
        }) as unknown as Response
    ) as unknown as typeof fetch
    const third = render(<OAuthConsentContent navigate={jest.fn()} />)
    const thirdNote = await third.findByRole('note')
    expect(thirdNote).toHaveTextContent('It returns you to https://claude.ai.')
  })

  it('fails closed with non-empty active origin when two known apps share one client', async () => {
    getAuthorizationDetails.mockResolvedValue({
      data: makeDetails(CLAUDE_URI, 'Claude'),
      error: null
    })
    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            success: true,
            data: { redirects: [CLAUDE_URI, CHATGPT_URI] }
          })
        }) as unknown as Response
    ) as unknown as typeof fetch

    render(<OAuthConsentContent navigate={jest.fn()} />)
    const note = await screen.findByRole('note')
    expect(note).toHaveTextContent('Unverified app.')
    expect(note).toHaveTextContent('It returns you to https://claude.ai.')
    expect(note).toHaveTextContent('https://chatgpt.com')
  })

  it('displays active origin and extra loopback origin accurately when client combines known and local URIs', async () => {
    getAuthorizationDetails.mockResolvedValue({
      data: makeDetails(CURSOR_URI, 'Cursor'),
      error: null
    })
    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            success: true,
            data: { redirects: [CURSOR_URI, LOCAL_URI] }
          })
        }) as unknown as Response
    ) as unknown as typeof fetch

    render(<OAuthConsentContent navigate={jest.fn()} />)
    await screen.findByRole('button', { name: 'Allow' })
    expect(screen.getByText(/Returns you to/i)).toHaveTextContent(
      'Returns you to https://www.cursor.com. This app can also send your sign-in to http://localhost:8787, on this computer. Allow it only if you just started it.'
    )
  })

  it('gates isRedirect behind appTrust and safe URL checks', async () => {
    const knownNav = jest.fn()
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: `${CLAUDE_URI}?code=1` },
      error: null
    })
    const knownView = render(<OAuthConsentContent navigate={knownNav} />)
    await waitFor(() => expect(knownNav).toHaveBeenCalledWith(`${CLAUDE_URI}?code=1`))
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    knownView.unmount()

    const localNav = jest.fn()
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: `${LOCAL_URI}?code=2` },
      error: null
    })
    const localView = render(<OAuthConsentContent navigate={localNav} />)
    await waitFor(() => expect(localNav).toHaveBeenCalledWith(`${LOCAL_URI}?code=2`))
    localView.unmount()

    const blockedNav = jest.fn()
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: 'javascript:alert(1)' },
      error: null
    })
    const blockedView = render(<OAuthConsentContent navigate={blockedNav} />)
    expect(await blockedView.findByText('This request has ended')).toBeInTheDocument()
    expect(blockedNav).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
    blockedView.unmount()

    const unknownNav = jest.fn()
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: `${EVIL_URI}?code=3` },
      error: null
    })
    const unknownView = render(<OAuthConsentContent navigate={unknownNav} />)
    expect(await unknownView.findByText('Return to this app?')).toBeInTheDocument()
    expect(unknownView.getByRole('note')).toHaveTextContent('https://evil.example')
    expect(unknownNav).not.toHaveBeenCalled()

    fireEvent.click(unknownView.getByRole('button', { name: 'Continue' }))
    expect(unknownNav).toHaveBeenCalledWith(`${EVIL_URI}?code=3`)
    unknownView.unmount()

    const cancelNav = jest.fn()
    getAuthorizationDetails.mockResolvedValueOnce({
      data: { redirect_url: `${EVIL_URI}?code=4` },
      error: null
    })
    const cancelView = render(<OAuthConsentContent navigate={cancelNav} />)
    await cancelView.findByText('Return to this app?')
    fireEvent.click(cancelView.getByRole('button', { name: 'Cancel' }))
    expect(cancelNav).not.toHaveBeenCalled()
    expect(cancelView.getByText('Sign-in cancelled')).toBeInTheDocument()
  })

  it('renders unavailable error state cleanly when getAuthorizationDetails rejects', async () => {
    getAuthorizationDetails.mockRejectedValueOnce(new Error('auth network failure'))

    render(<OAuthConsentContent navigate={jest.fn()} />)

    expect(await screen.findByText('We couldn’t load this request')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('explains that new documents are public unless made Invite only', async () => {
    getAuthorizationDetails.mockResolvedValueOnce({
      data: makeDetails(CLAUDE_URI, 'Claude'),
      error: null
    })
    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ success: true, data: { redirects: [CLAUDE_URI] } })
        }) as unknown as Response
    ) as unknown as typeof fetch

    render(<OAuthConsentContent navigate={jest.fn()} />)

    expect(
      await screen.findByText(
        'Create documents. A new document is public unless the app makes it Invite only.'
      )
    ).toBeInTheDocument()
  })
})
