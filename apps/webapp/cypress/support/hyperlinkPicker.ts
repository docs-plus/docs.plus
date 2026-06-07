/* eslint-disable no-undef */

import type { EditorWindow } from './commands'

/** macOS → Meta+K, Linux/Windows → Control+K. Mirrors the extension's runtime keymap; keep them in sync. */
export const ADD_LINK_KEYS: string[] =
  Cypress.platform === 'darwin' ? ['Meta', 'k'] : ['Control', 'k']

export const PICKER_SELECTORS = {
  pm: '.docy_editor > .tiptap.ProseMirror',
  editorLink: '.docy_editor a',
  createPopover: '[data-testid="hyperlink-create-popover"]',
  editPopover: '[data-testid="hyperlink-edit-popover"]',
  urlInput: '[data-testid="hyperlink-editor-url"]',
  textInput: '[data-testid="hyperlink-editor-text"]',
  submit: '[data-testid="hyperlink-editor-submit"]',
  expand: '[data-testid="hyperlink-suggestions-expand"]',
  suggestionsBack: '[data-testid="hyperlink-suggestions-back"]',
  row: '[data-testid="hyperlink-suggestion-row"]',
  // Filter rows by kind via the data attribute SuggestionRow stamps.
  headingRow: '[data-testid="hyperlink-suggestion-row"][data-suggestion-kind="heading"]',
  bookmarkRow: '[data-testid="hyperlink-suggestion-row"][data-suggestion-kind="bookmark"]'
}

const TEST_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001'

/** A row shaped like `TBookmarkWithMessage` — only the fields read by `useHyperlinkSuggestions`. */
const bookmarkRow = (input: {
  id: number
  text: string
  messageId: string
  channelId: string
  archived?: boolean
  createdAt?: string
}) => ({
  bookmark_id: input.id,
  bookmark_created_at: input.createdAt ?? new Date(2026, 0, input.id).toISOString(),
  bookmark_updated_at: input.createdAt ?? new Date(2026, 0, input.id).toISOString(),
  bookmark_archived_at: input.archived ? new Date(2026, 0, input.id).toISOString() : null,
  bookmark_marked_at: null,
  bookmark_metadata: {},
  message_id: input.messageId,
  message_content: input.text,
  message_html: `<p>${input.text}</p>`,
  message_created_at: new Date(2026, 0, input.id).toISOString(),
  message_user_id: 'user-1',
  message_channel_id: input.channelId,
  message_type: 'message',
  user_details: {
    id: 'user-1',
    username: 'cypress',
    fullname: 'Cypress',
    avatar_url: null,
    avatar_updated_at: null
  },
  channel_name: 'general',
  channel_slug: 'general',
  workspace_id: TEST_WORKSPACE_ID,
  workspace_name: 'Test',
  workspace_slug: 'test'
})

/**
 * Static fixture covering the two interesting cases (active + archived).
 * Fields outside `bookmark_id` / `message_content` / `message_id` /
 * `message_channel_id` / `bookmark_archived_at` / `bookmark_created_at`
 * are unused by `useHyperlinkSuggestions` but kept for shape parity.
 */
export const TEST_BOOKMARKS = {
  active: bookmarkRow({
    id: 1,
    text: 'Sprint kickoff notes',
    messageId: 'msg-active-1',
    channelId: 'chan-active'
  }),
  archived: bookmarkRow({
    id: 2,
    text: 'Old retrospective',
    messageId: 'msg-archived-1',
    channelId: 'chan-archived',
    archived: true
  })
}

/**
 * Wire the playground to render the bookmark section in the picker:
 * 1. Stub the Supabase RPC for both `archived=false` and `archived=true`
 *    fetches (the hook fires both in parallel).
 * 2. Seed `workspaceId` in the Zustand store via `_store` so
 *    `useHyperlinkSuggestions` flips `queriesEnabled` on.
 *
 * Call AFTER `cy.visitEditor` (the editor effect that publishes
 * `window._store` must have run).
 */
export const setupBookmarkSuggestions = (
  rows: Array<typeof TEST_BOOKMARKS.active | typeof TEST_BOOKMARKS.archived> = [
    TEST_BOOKMARKS.active,
    TEST_BOOKMARKS.archived
  ]
): void => {
  const active = rows.filter((r) => r.bookmark_archived_at === null)
  const archived = rows.filter((r) => r.bookmark_archived_at !== null)

  cy.intercept('POST', '**/rpc/get_user_bookmarks*', (req) => {
    const isArchivedQuery = (req.body as { p_archived?: boolean }).p_archived === true
    req.reply({ statusCode: 200, body: isArchivedQuery ? archived : active })
  }).as('getUserBookmarks')

  cy.window().then((w) => {
    const win = w as unknown as EditorWindow
    if (!win._store) throw new Error('window._store missing — visitEditor must run first')
    win._store.getState().setWorkspaceSetting('workspaceId', TEST_WORKSPACE_ID)
  })
}
