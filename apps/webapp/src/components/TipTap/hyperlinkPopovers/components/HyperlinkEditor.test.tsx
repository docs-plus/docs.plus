import '@testing-library/jest-dom'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'

import { HyperlinkEditor } from './HyperlinkEditor'

jest.mock('@stores', () => ({
  useStore: (selector: any) => selector({ settings: { workspaceId: undefined } })
}))

// Bypass the data layer for the smoke test; suggestions render is
// covered by HyperlinkSuggestions.test.tsx.
jest.mock('../hooks/useHyperlinkSuggestions', () => ({
  useHyperlinkSuggestions: () => ({
    headings: [],
    bookmarks: [],
    isLoading: false,
    isError: false
  })
}))

const fakeEditor: any = {
  state: {
    doc: { descendants: () => undefined, content: { childCount: 0 } },
    selection: { empty: true }
  },
  on: () => undefined,
  off: () => undefined,
  chain: () => fakeEditor,
  focus: () => fakeEditor,
  run: () => true,
  view: { posAtDOM: () => 0 }
}

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

describe('<HyperlinkEditor>', () => {
  it('renders the URL input in create mode', () => {
    renderWithClient(
      <HyperlinkEditor
        mode="create"
        variant="desktop"
        editor={fakeEditor}
        initialHref=""
        defaultSuggestionsState="collapsed"
        onApply={() => undefined}
        onClose={() => undefined}
      />
    )
    expect(screen.getByRole('button', { name: /^apply$/i })).toBeInTheDocument()
    expect(screen.queryByLabelText(/^text$/i)).not.toBeInTheDocument()
  })

  it('renders both URL and Text inputs in edit mode', () => {
    renderWithClient(
      <HyperlinkEditor
        mode="edit"
        variant="desktop"
        editor={fakeEditor}
        initialHref="https://example.com"
        initialText="Example"
        defaultSuggestionsState="collapsed"
        onApply={() => undefined}
        onClose={() => undefined}
      />
    )
    expect(screen.getByDisplayValue('https://example.com')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Example')).toBeInTheDocument()
  })
})
