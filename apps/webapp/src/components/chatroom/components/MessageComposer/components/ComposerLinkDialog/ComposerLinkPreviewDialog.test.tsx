import { padNavigate } from '@components/TipTap/hyperlinkPopovers/hrefEventHandler'
import { fireEvent, render } from '@testing-library/react'

import { ComposerLinkPreviewDialog } from './ComposerLinkPreviewDialog'

jest.mock('@utils/supabase', () => ({
  supabaseClient: { auth: { getSession: async () => ({ data: { session: null } }) } }
}))
jest.mock('@components/TipTap/hyperlinkPopovers/hrefEventHandler', () => ({
  ...jest.requireActual('@components/TipTap/hyperlinkPopovers/hrefEventHandler'),
  padNavigate: jest.fn()
}))

const navigate = padNavigate as jest.MockedFunction<typeof padNavigate>

const openRow = (href: string, calls: string[] = []) => {
  navigate.mockImplementation((to, { newTab }) => calls.push(`navigate ${to} newTab=${newTab}`))
  const view = render(
    <ComposerLinkPreviewDialog
      href={href}
      onEdit={() => {}}
      onRemove={() => {}}
      onClose={() => calls.push('close')}
    />
  )
  return { row: view.queryByTestId('composer-link-preview-open'), calls }
}

// C6 with #359: Open is a plain open. `navigateHref` then picks a new tab or an in-place route.
describe('ComposerLinkPreviewDialog Open link', () => {
  beforeEach(() => navigate.mockReset())

  it('closes, then passes an external page as a plain open', () => {
    const { row, calls } = openRow('https://example.com/page')
    fireEvent.click(row!)
    expect(calls).toEqual(['close', 'navigate https://example.com/page newTab=false'])
  })

  it('shows no Open row for mailto: or tel:', () => {
    expect(openRow('mailto:a@example.com').row).toBeNull()
    expect(openRow('tel:+15551234567').row).toBeNull()
  })
})
