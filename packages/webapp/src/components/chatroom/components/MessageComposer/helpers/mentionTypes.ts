import type { Editor } from '@tiptap/core'
import type { Database } from '@types'

export type MentionPickerUser =
  Database['public']['Functions']['fetch_mentioned_users']['Returns'][number]

export type MentionPickerEveryone = {
  id: 'everyone'
  username: 'everyone'
  full_name: 'All Users'
  isEveryone: true
}

export type MentionPickerEntry = MentionPickerEveryone | MentionPickerUser

export const MENTION_LISTBOX_ID = 'mention-suggestion-listbox'

export const MENTION_SUGGESTION_POPUP_SELECTOR = '.mention-suggestion-popup'

let mentionPopupOpen = false
let mentionPickerActive = false
const mentionPopupListeners = new Set<() => void>()

function notifyMentionPopupListeners(): void {
  mentionPopupListeners.forEach((listener) => listener())
}

export function setMentionPopupOpen(open: boolean): void {
  if (mentionPopupOpen === open) return
  mentionPopupOpen = open
  syncMentionPickerActive()
}

/** Sync toolbar active state when Floating UI hides the popup without tearing down. */
export function syncMentionPickerActive(): void {
  const active = isMentionSuggestionPopupVisible()
  if (mentionPickerActive === active) return
  mentionPickerActive = active
  notifyMentionPopupListeners()
}

export function getMentionPickerActive(): boolean {
  return mentionPickerActive
}

export function subscribeMentionPopup(listener: () => void): () => void {
  mentionPopupListeners.add(listener)
  return () => mentionPopupListeners.delete(listener)
}

export function getMentionPopupOpen(): boolean {
  return mentionPopupOpen
}

/** Route mention teardown through `@tiptap/suggestion` onExit (Escape contract). */
export function dismissComposerMentionSuggestion(editor: Editor | null | undefined): void {
  if (!editor || !getMentionPopupOpen()) return
  editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true
    })
  )
}

/** True while the Floating UI mention picker is mounted and visible. */
export function isMentionSuggestionPopupVisible(): boolean {
  if (!getMentionPopupOpen()) return false
  const el = document.querySelector(MENTION_SUGGESTION_POPUP_SELECTOR)
  return (
    el instanceof HTMLElement &&
    el.isConnected &&
    window.getComputedStyle(el).visibility !== 'hidden'
  )
}

export function mentionOptionId(index: number): string {
  return `mention-option-${index}`
}

export const EVERYONE_ENTRY: MentionPickerEveryone = {
  id: 'everyone',
  username: 'everyone',
  full_name: 'All Users',
  isEveryone: true
}

export function isEveryone(entry: MentionPickerEntry): entry is MentionPickerEveryone {
  return 'isEveryone' in entry && entry.isEveryone === true
}

export function displayName(entry: MentionPickerEntry): string {
  if (isEveryone(entry)) return entry.full_name
  return entry.full_name || entry.display_name || entry.username
}

export function showEveryoneForQuery(query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return q.includes('everyone') || q === 'all'
}
