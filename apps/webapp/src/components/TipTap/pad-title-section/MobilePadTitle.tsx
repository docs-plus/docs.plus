import { useFadeAfterFirstSync } from '@components/pages/document/hooks/useFadeAfterFirstSync'
import { useSettingsModal } from '@components/settings/hooks/useSettingsModal'
import { SettingsTakeover } from '@components/settings/SettingsTakeover'
import type { TabType } from '@components/settings/types'
import { indicatorDotClassName } from '@components/TipTap/toolbar/indicatorDot'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import ToolbarDivider from '@components/TipTap/toolbar/ToolbarDivider'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { RenameDialog } from '@components/ui/dialogs/RenameDialog'
import { ModalDrawerOpener } from '@components/ui/ModalDrawer'
import UnreadBadge from '@components/ui/UnreadBadge'
import { canEditDocumentMetadata } from '@hooks/canEditDocumentMetadata'
import { clearOverlayHash, useHashOverlay } from '@hooks/useHashOverlay'
import { useNotificationCount } from '@hooks/useNotificationCount'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { Icons } from '@icons'
import { releasePadEditMode } from '@services/openHeadingChatroom'
import {
  selectInProgressBookmarkCount,
  selectIsSignedIn,
  selectSettingsMayOpen,
  useAuthStore,
  useChatStore,
  useSheetStore,
  useStore,
  withInProgressBookmarks
} from '@stores'
import { onlineManager } from '@tanstack/react-query'
import type { Editor } from '@tiptap/core'
import { yUndoPluginKey } from '@tiptap/y-tiptap'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import { plainTitle } from '@utils/titleWrite'
import { twMerge } from '@utils/twMerge'
import React, { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'

import FilterBar from './FilterBar'
import PrivateIndicator from './PrivateIndicator'
import ProviderSyncStatus from './ProviderSyncStatus'
import ReadOnlyIndicator from './ReadOnlyIndicator'

interface UserProfileButtonProps {
  user: {
    id?: string
    avatar_updated_at?: string | null
    avatar_url?: string | null
  } | null
  isSignedIn: boolean
  onProfileClick: () => void
}

interface UndoRedoButtonsProps {
  editor: Editor | null
  className?: string
}

const EditableToggle = ({ isEditable, onDone }: { isEditable: boolean; onDone: () => void }) => {
  const user = useAuthStore((state) => state.profile)
  const inProgressBookmarks = useChatStore(selectInProgressBookmarkCount)
  // The drawer holds the Bookmarks button, so its dot shows here before the drawer opens.
  const showBookmarksDot = !!user && inProgressBookmarks > 0

  if (isEditable) {
    return (
      <ToolbarButton
        onPress={onDone}
        aria-label="Done editing"
        className="text-primary touch-manipulation"
        size="sm">
        <Icons.check size={20} className="stroke-[1.75]" />
      </ToolbarButton>
    )
  }

  return (
    <ModalDrawerOpener
      modalId="mobile_left_side_panel"
      ariaLabel={withInProgressBookmarks('Open menu', showBookmarksDot ? inProgressBookmarks : 0)}
      className="btn btn-ghost btn-square btn-sm relative touch-manipulation">
      <Icons.menu size={20} className="text-base-content/70 stroke-[1.75]" />
      {showBookmarksDot && (
        <span
          data-testid="bookmarks-in-progress-indicator-menu"
          className={indicatorDotClassName('ring-base-100')}
          aria-hidden
        />
      )}
    </ModalDrawerOpener>
  )
}

const UserProfileButton = ({ user, isSignedIn, onProfileClick }: UserProfileButtonProps) => {
  if (user) {
    return (
      <Button
        variant="ghost"
        shape="circle"
        size="md"
        className="border-0 p-0"
        onClick={onProfileClick}
        aria-label="Profile"
        tooltip="Profile"
        tooltipPlacement="bottom">
        <Avatar face={user} clickable={false} size="md" className="pointer-events-none" />
      </Button>
    )
  }

  // The session lands before the profile, so hold the avatar slot rather than show Sign in.
  if (isSignedIn) return <div className="skeleton size-10 shrink-0 rounded-full" aria-hidden />

  return (
    <Button variant="neutral" size="sm" onClick={onProfileClick}>
      Sign in
    </Button>
  )
}

const NotificationButton = () => {
  const openNotifications = () => useSheetStore.getState().openSheet('notifications')
  const workspaceId = useStore((state) => state.settings.workspaceId)
  const unreadCount = useNotificationCount({ workspaceId })

  return (
    <Button
      variant="ghost"
      size="sm"
      shape="square"
      className="relative"
      onClick={openNotifications}
      aria-label="Notifications"
      tooltip="Notifications"
      tooltipPlacement="bottom">
      <Icons.notificationsActive size={20} className="text-base-content/70 stroke-[1.75]" />
      <UnreadBadge
        count={unreadCount}
        size="xs"
        variant="error"
        className="absolute top-0.5 right-0.5"
      />
    </Button>
  )
}

const CAN_UNDO = 1
const CAN_REDO = 2

// The pad editor always has Collaboration, so the Yjs stack events cover every change.
// Not a transaction selector: redo is pushed after the PM transaction, and clear()
// dispatches none.
const useUndoRedoState = (editor: Editor | null): number => {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!editor) return () => {}
      const undoManager = yUndoPluginKey.getState(editor.state)?.undoManager
      const stackEvents = ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const
      stackEvents.forEach((name) => undoManager?.on(name, notify))
      return () => stackEvents.forEach((name) => undoManager?.off(name, notify))
    },
    [editor]
  )
  const getSnapshot = () => {
    if (!editor || editor.isDestroyed) return 0
    const um = yUndoPluginKey.getState(editor.state)?.undoManager
    return (um?.undoStack.length ? CAN_UNDO : 0) | (um?.redoStack.length ? CAN_REDO : 0)
  }
  return useSyncExternalStore(subscribe, getSnapshot, () => 0)
}

const UndoRedoButtons = ({ editor, className }: UndoRedoButtonsProps) => {
  const undoRedo = useUndoRedoState(editor)

  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex items-center gap-2">
        <ToolbarButton
          onPress={() => editor?.commands.undo()}
          disabled={!(undoRedo & CAN_UNDO)}
          aria-label="Undo"
          className="touch-manipulation"
          size="sm">
          <Icons.undo size={20} className="stroke-[1.75]" />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor?.commands.redo()}
          disabled={!(undoRedo & CAN_REDO)}
          aria-label="Redo"
          className="touch-manipulation"
          size="sm">
          <Icons.redo size={20} className="stroke-[1.75]" />
        </ToolbarButton>
      </div>
      <ToolbarDivider />
    </div>
  )
}

const TitleEditContent = () => {
  const metadata = useStore((state) => state.settings.metadata)
  const closeDialog = useStore((state) => state.closeDialog)
  const { isPending, mutate } = useUpdateDocMetadata()

  const handleSave = (draft: string) => {
    const trimmed = plainTitle(draft.trim())
    if (!trimmed || trimmed === plainTitle(metadata?.title ?? '')) {
      closeDialog()
      return
    }

    // The hook updates the header and relays the title, even after this dialog unmounts.
    mutate(
      { title: trimmed, documentId: metadata.documentId, slug: metadata.slug },
      { onSuccess: () => closeDialog() }
    )
    // Offline, the save is queued; do not leave the dialog on a busy Rename button.
    if (!onlineManager.isOnline()) closeDialog()
  }

  return (
    <RenameDialog
      initialValue={plainTitle(metadata?.title || '')}
      onSave={handleSave}
      busy={isPending}
      maxLength={200}
    />
  )
}

const MobilePadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const isEditable = useStore((state) => state.settings.editor.isEditable)
  const editor = useStore((state) => state.settings.editor.instance)
  const metadata = useStore((state) => state.settings.metadata)
  const openDialog = useStore((state) => state.openDialog)
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)
  const profileId = useAuthStore((state) => state.profile?.id ?? state.session?.id)
  const canEditMetadata = useStore((state) => canEditDocumentMetadata(state.settings, profileId))
  const isSignedIn = useAuthStore(selectIsSignedIn)
  const [fadeIn] = useFadeAfterFirstSync()
  // The read↔edit crossfade plays from the first mode swap on, never on mount. At the
  // S0→S1 swap the S0 header already sits here, so a fade would blink it.
  const [initialEditable] = useState(isEditable)
  const [crossfade, setCrossfade] = useState(false)
  if (!crossfade && isEditable !== initialEditable) setCrossfade(true)
  const { isOpen: isProfileModalOpen, setIsOpen: setProfileModalOpen } = useSettingsModal()
  const [settingsTab, setSettingsTab] = useState<TabType | undefined>(undefined)
  const { overlay, settingsTab: hashSettingsTab } = useHashOverlay()
  const settingsMayOpen = useAuthStore(selectSettingsMayOpen)

  // Settings is navigation, not a typing continuation — drop the keyboard before the takeover.
  // No argument means the avatar button, which must not reopen the tab a hash asked for.
  const openSettings = useCallback(
    (tab?: TabType) => {
      if (isKeyboardOpen) {
        setTimeout(() => editor?.view.dom.blur(), 50)
      }
      setSettingsTab(tab)
      setProfileModalOpen(true)
    },
    [isKeyboardOpen, editor, setProfileModalOpen]
  )

  // The hash is a one-shot instruction. A layout effect, so the replaceState lands before
  // useSettingsModal pushes its takeover entry and not on top of it. While auth loads,
  // Settings opens on its skeleton and the hash waits for the profile.
  useLayoutEffect(() => {
    if (!overlay) return
    if (user) clearOverlayHash()
    if (overlay === 'notifications') {
      if (user) useSheetStore.getState().openSheet('notifications')
    } else if (settingsMayOpen) openSettings(hashSettingsTab ?? undefined)
  }, [overlay, hashSettingsTab, user, settingsMayOpen, openSettings])

  // Set by "Done" so focus lands on the title (not <body>) once the read cluster remounts.
  const focusTitleAfterExitRef = useRef(false)

  const handleTitleClick = () => {
    openDialog(<TitleEditContent />, { size: 'md', align: 'top', className: 'mt-14' })
  }

  // Unlike the sheet path, "Done" releases edit mode unconditionally (iOS can still have the keyboard
  // up before `isKeyboardOpen` flips) and re-homes focus to the title.
  const exitEditMode = useCallback(() => {
    focusTitleAfterExitRef.current = true
    releasePadEditMode()
  }, [])

  return (
    <>
      {/* Opacity only — no transforms next to the sticky/visualViewport machinery. */}
      <header
        className={twMerge(
          'bg-base-100 sticky top-0 left-0 z-30 w-full',
          fadeIn && 'motion-safe:animate-[doc-content-in_220ms_ease-out_both]'
        )}>
        <div className="border-base-300 flex min-h-12 w-full flex-col border-b px-2 py-2">
          <div className="flex w-full items-center justify-between gap-2">
            {/* Keyed so the read↔edit control swap crossfades (opacity only:
                the sticky header rides the visualViewport machinery) */}
            <div
              key={isEditable ? 'edit' : 'read'}
              className={twMerge(
                'flex min-w-0 flex-1 items-center gap-1',
                crossfade && 'motion-safe:animate-[doc-content-in_120ms_ease-out_both]'
              )}>
              <EditableToggle isEditable={isEditable} onDone={exitEditMode} />

              {isEditable ? (
                <UndoRedoButtons editor={editor ?? null} className="ml-2" />
              ) : (
                <button
                  type="button"
                  ref={(el) => {
                    if (el && focusTitleAfterExitRef.current) {
                      focusTitleAfterExitRef.current = false
                      el.focus()
                    }
                  }}
                  className="min-w-0 flex-1 truncate text-left text-lg font-semibold"
                  aria-disabled={!canEditMetadata}
                  onClick={canEditMetadata ? handleTitleClick : undefined}>
                  {plainTitle(metadata?.title || '') || 'Untitled'}
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <ProviderSyncStatus compact />
              <PrivateIndicator />
              <ReadOnlyIndicator />
              {isSignedIn && <NotificationButton />}
              <UserProfileButton
                user={user}
                isSignedIn={isSignedIn}
                onProfileClick={user ? () => openSettings() : () => openInlineSignInDialog()}
              />
            </div>
          </div>

          <div className="w-full">
            <FilterBar displayRestButton />
          </div>
        </div>
      </header>

      <SettingsTakeover
        open={isProfileModalOpen}
        onOpenChange={setProfileModalOpen}
        defaultTab={settingsTab}
      />
    </>
  )
}

export default MobilePadTitle
