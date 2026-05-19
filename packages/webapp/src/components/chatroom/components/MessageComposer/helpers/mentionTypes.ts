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

/** True while the Floating UI mention picker is mounted and visible. */
export function isMentionSuggestionPopupVisible(): boolean {
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
