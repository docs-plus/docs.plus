import { selectPadOwnsKeyboard } from '@components/chatroom/utils/selectPadOwnsKeyboard'
import type { TabType } from '@components/settings/types'
import { canOpenFind } from '@components/TipTap/find/canOpenFind'
import { filterOpenRequest } from '@components/TipTap/toolbar/desktop/popoverOpenRequest'
import { openOverlayHash } from '@hooks/useHashOverlay'
import { Icons } from '@icons'
import { useChatStore, useSheetStore } from '@stores'
import type { Editor } from '@tiptap/core'
import type { IconType } from 'react-icons'

export type CommandJumpSurface = 'home' | 'pad'

export type PlaceRow = { id: string; label: string; icon: IconType; run: () => void }

type PlaceContext = {
  surface: CommandJumpSurface
  signedIn: boolean
  isHistory: boolean
  isMobile: boolean
  editor: Editor | null
  navigate: (path: string) => void
}

const settingsRow = (id: string, label: string, icon: IconType, tab?: TabType): PlaceRow => ({
  id,
  label,
  icon,
  run: () => openOverlayHash('settings', tab)
})

/**
 * Place rows for the route, in the #254 order. Read once per open, because the Filter
 * request and the chat pane state are not reactive. The history view mounts no pad
 * title, so no hash reader runs there and only the route rows stay.
 */
export function buildPlaceRows(ctx: PlaceContext): PlaceRow[] {
  const rows: PlaceRow[] = []
  const livePad = ctx.surface === 'pad' && !ctx.isHistory
  const editor = livePad && ctx.editor && !ctx.editor.isDestroyed ? ctx.editor : null
  const hasSettings = ctx.signedIn && (ctx.surface === 'home' || livePad)

  if (livePad) {
    rows.push({
      id: 'history',
      label: 'History',
      icon: Icons.history,
      run: () => (window.location.hash = 'history')
    })
  }

  if (hasSettings) {
    rows.push(
      settingsRow('documents', 'Documents', Icons.documents, 'documents'),
      settingsRow('profile', 'Profile', Icons.user, 'profile'),
      settingsRow('appearance', 'Appearance', Icons.sun, 'appearance'),
      settingsRow('security', 'Security', Icons.lock, 'security'),
      settingsRow('settings', 'Settings', Icons.settings)
    )
  }

  if (editor && (ctx.isMobile || filterOpenRequest.canRequest())) {
    rows.push({
      id: 'filter',
      label: 'Filter',
      icon: Icons.filter,
      run: () => {
        if (ctx.isMobile) useSheetStore.getState().openSheet('filters')
        else filterOpenRequest.request()
      }
    })
  }

  // The phone find bar yields to an open chat pane, so it would close at once.
  if (editor && canOpenFind(ctx.isMobile, selectPadOwnsKeyboard(useChatStore.getState()))) {
    rows.push({
      id: 'find',
      label: 'Find in document',
      icon: Icons.search,
      run: () => editor.commands.openCaretFind()
    })
  }

  if (livePad && ctx.signedIn) {
    rows.push({
      id: 'notifications',
      label: 'Notifications',
      icon: Icons.notifications,
      run: () => openOverlayHash('notifications')
    })
  }

  rows.push(
    { id: 'new', label: 'New document', icon: Icons.plus, run: () => ctx.navigate('/new') },
    { id: 'demo', label: 'Demo', icon: Icons.fileOpen, run: () => ctx.navigate('/demo') }
  )

  return rows
}
