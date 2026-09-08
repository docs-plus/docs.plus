import '@testing-library/jest-dom'

import { render, screen } from '@testing-library/react'

import { SettingsTakeover } from './SettingsTakeover'

let profile: { id: string } | null = null

jest.mock('@stores', () => ({
  useAuthStore: (selector: (state: { profile: unknown }) => unknown) => selector({ profile })
}))

// `SettingsPanelSkeleton` is the `dynamic()` fallback, and it reads the route.
jest.mock('next/router', () => ({ useRouter: () => ({ pathname: '/' }) }))

// The real panel is a `dynamic()` that drags the router, the API layer and five more
// lazy sections into jsdom. The shell is what these checks are about.
jest.mock('./SettingsPanel', () => ({
  __esModule: true,
  default: ({ defaultTab }: { defaultTab?: string }) => (
    <div data-testid="settings-panel">{defaultTab ?? 'no-tab'}</div>
  )
}))

describe('<SettingsTakeover>', () => {
  afterEach(() => {
    profile = null
  })

  it('renders nothing when no profile is signed in', () => {
    render(<SettingsTakeover open onOpenChange={() => undefined} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('names the surface "Settings" and passes the tab through', async () => {
    profile = { id: 'user-1' }
    render(<SettingsTakeover open onOpenChange={() => undefined} defaultTab="documents" />)

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Settings')
    expect(await screen.findByTestId('settings-panel')).toHaveTextContent('documents')
  })
})
