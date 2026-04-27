import '@testing-library/jest-dom'

import { fireEvent, render, screen } from '@testing-library/react'

import type { BookmarkSuggestion, HeadingSuggestion } from '../types'
import { HyperlinkSuggestions } from './HyperlinkSuggestions'

const headings: HeadingSuggestion[] = [
  { kind: 'heading', id: 'h1', title: 'Intro', level: 1, breadcrumb: ['intro'] },
  { kind: 'heading', id: 'h2', title: 'Setup', level: 2, breadcrumb: ['intro', 'setup'] }
]

const bookmarks: BookmarkSuggestion[] = [
  {
    kind: 'bookmark',
    id: 'b1',
    title: 'Active note',
    messageId: 'm1',
    channelId: 'c1',
    archived: false,
    createdAt: ''
  },
  {
    kind: 'bookmark',
    id: 'b2',
    title: 'Old note',
    messageId: 'm2',
    channelId: 'c1',
    archived: true,
    createdAt: ''
  }
]

const baseProps = {
  headings,
  bookmarks,
  highlightIndex: null,
  isLoading: false,
  onPick: jest.fn(),
  onExpand: jest.fn(),
  onBack: jest.fn(),
  onRowHover: jest.fn(),
  rowIdPrefix: 'hl-test'
}

describe('<HyperlinkSuggestions>', () => {
  it('renders only the collapsed expander when panel=collapsed', () => {
    render(<HyperlinkSuggestions {...baseProps} panel="collapsed" />)
    expect(screen.getByRole('button', { name: /browse headings/i })).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('renders both sections when populated and panel=browsing', () => {
    render(<HyperlinkSuggestions {...baseProps} panel="browsing" />)
    expect(screen.getByRole('group', { name: 'Headings' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Bookmarks' })).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('marks the highlighted row as aria-selected', () => {
    render(<HyperlinkSuggestions {...baseProps} panel="browsing" highlightIndex={1} />)
    const rows = screen.getAllByRole('option')
    expect(rows[1]).toHaveAttribute('aria-selected', 'true')
    expect(rows[0]).toHaveAttribute('aria-selected', 'false')
  })

  it('renders an Archived badge on archived bookmark rows', () => {
    render(<HyperlinkSuggestions {...baseProps} panel="browsing" />)
    expect(screen.getByText(/archived/i)).toBeInTheDocument()
  })

  it('emits onPick with the row suggestion when clicked', () => {
    const onPick = jest.fn()
    render(<HyperlinkSuggestions {...baseProps} panel="browsing" onPick={onPick} />)
    fireEvent.click(screen.getAllByRole('option')[2])
    expect(onPick).toHaveBeenCalledWith(bookmarks[0])
  })

  it('shows "No matches" when both lists are empty and not loading', () => {
    render(<HyperlinkSuggestions {...baseProps} panel="searching" headings={[]} bookmarks={[]} />)
    expect(screen.getByText(/no matches/i)).toBeInTheDocument()
  })
})
