import type { ChatPaneMode } from '@types'

/**
 * The pad can only take the keyboard while the chat pane is closed — the document is
 * scroll-only at every other mode. Deliberately separate from
 * `selectDocumentEditingLocked`, which `CONTEXT.md` reserves for the durable access
 * concept; this is transient layout state.
 */
export const selectPadOwnsKeyboard = (state: { chatRoom: { paneMode: ChatPaneMode } }): boolean =>
  state.chatRoom.paneMode === 'closed'
