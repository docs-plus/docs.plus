import { useSettingsModal } from '@components/settings/hooks/useSettingsModal'
import SettingsPanelSkeleton from '@components/settings/SettingsPanelSkeleton'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import UnreadBadge from '@components/ui/UnreadBadge'
import { canEditDocumentMetadata } from '@hooks/canEditDocumentMetadata'
import { useBottomSheet } from '@hooks/useBottomSheet'
import { useNotificationCount } from '@hooks/useNotificationCount'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { Icons } from '@icons'
import { releasePadEditMode } from '@services/openHeadingChatroom'
import { useAuthStore, useStore } from '@stores'
import type { Editor } from '@tiptap/core'
import { openInlineSignInDialog } from '@utils/openInlineSignInDialog'
import dynamic from 'next/dynamic'
import React, { useCallback, useEffect, useRef, useState } from 'react'

const SettingsPanel = dynamic(() => import('@components/settings/SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})

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
  onProfileClick: () => void
}

interface UndoRedoButtonsProps {
  editor: Editor | null
  className?: string
}

interface StatelessPayloadEvent {
  payload: string
}

interface DocTitleMessage {
  type: 'docTitle'
  state: {
    title: string
    [key: string]: unknown
  }
}

interface MetadataMutationResponse {
  title: string
  [key: string]: unknown
}

const extractMetadataMutationResponse = (response: unknown): MetadataMutationResponse => {
  if (
    typeof response === 'object' &&
    response !== null &&
    'data' in response &&
    typeof response.data === 'object' &&
    response.data !== null
  ) {
    return response.data as MetadataMutationResponse
  }

  return response as MetadataMutationResponse
}

const EditableToggle = ({ isEditable, onDone }: { isEditable: boolean; onDone: () => void }) => {
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

  // A `<label htmlFor>` toggles the drawer checkbox on click but isn't keyboard-operable on its
  // own. Adding role/tabIndex/keydown makes the label a real button (it opens the TOC — not
  // "close sidebar").
  return (
    <label
      htmlFor="mobile_left_side_panel"
      aria-label="Open menu"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.currentTarget.click()
        }
      }}
      className="btn btn-ghost btn-square btn-sm touch-manipulation">
      <Icons.menu size={20} className="text-base-content/70 stroke-[1.75]" />
    </label>
  )
}

const UserProfileButton = ({ user, onProfileClick }: UserProfileButtonProps) => {
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

  return (
    <Button variant="neutral" size="sm" onClick={onProfileClick}>
      Sign in
    </Button>
  )
}

const NotificationButton = () => {
  const { openNotifications } = useBottomSheet()
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
      <Icons.notificationsActive
        size={20}
        className={
          unreadCount > 0 ? 'text-primary stroke-[1.75]' : 'text-base-content/70 stroke-[1.75]'
        }
      />
      <UnreadBadge
        count={unreadCount}
        size="xs"
        variant="error"
        className="absolute top-0.5 right-0.5"
      />
    </Button>
  )
}

const UndoRedoButtons = ({ editor, className }: UndoRedoButtonsProps) => {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="flex items-center gap-2">
        <ToolbarButton
          onPress={() => editor?.commands.undo()}
          editor={editor}
          type="undo"
          aria-label="Undo"
          className="touch-manipulation"
          size="sm">
          <Icons.undo size={20} className="text-base-content/70 stroke-[1.75]" />
        </ToolbarButton>
        <ToolbarButton
          onPress={() => editor?.commands.redo()}
          editor={editor}
          type="redo"
          aria-label="Redo"
          className="touch-manipulation"
          size="sm">
          <Icons.redo size={20} className="text-base-content/70 stroke-[1.75]" />
        </ToolbarButton>
      </div>
      <div className="divider divider-horizontal mx-2" />
    </div>
  )
}

const TitleEditContent = () => {
  const metadata = useStore((state) => state.settings.metadata)
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const closeDialog = useStore((state) => state.closeDialog)
  const { isPending, mutate } = useUpdateDocMetadata()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Populate + auto-select on mount (dialog just opened)
  useEffect(() => {
    setValue(metadata?.title || '')
    const timer = setTimeout(() => inputRef.current?.select(), 120)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSave = () => {
    const trimmed = value.trim()
    if (!trimmed || trimmed === metadata?.title) {
      closeDialog()
      return
    }

    mutate(
      { title: trimmed, documentId: metadata.documentId },
      {
        onSuccess: (responseData) => {
          const updated = extractMetadataMutationResponse(responseData)
          setWorkspaceSetting('metadata', { ...metadata, title: updated.title })
          hocuspocusProvider?.sendStateless(JSON.stringify({ type: 'docTitle', state: updated }))
          closeDialog()
        }
      }
    )
  }

  return (
    <div className="p-5">
      <label
        htmlFor="mobile-doc-title-input"
        className="text-base-content mb-3 block text-base font-semibold">
        Rename Document Title
      </label>

      <input
        ref={inputRef}
        id="mobile-doc-title-input"
        type="text"
        className="input input-bordered w-full"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') closeDialog()
        }}
        placeholder="Document title"
        autoComplete="off"
        maxLength={200}
      />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={closeDialog}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isPending || !value.trim()}>
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

const MobilePadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const isEditable = useStore((state) => state.settings.editor.isEditable)
  const editor = useStore((state) => state.settings.editor.instance)
  const metadata = useStore((state) => state.settings.metadata)
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)
  const openDialog = useStore((state) => state.openDialog)
  const isKeyboardOpen = useStore((state) => state.isKeyboardOpen)
  const canEditMetadata = useStore((state) => canEditDocumentMetadata(state.settings, user?.id))
  const { isOpen: isProfileModalOpen, setIsOpen: setProfileModalOpen } = useSettingsModal(!!user)

  // Settings is navigation, not a typing continuation — drop the keyboard before the takeover.
  const handleProfileOpen = useCallback(() => {
    if (isKeyboardOpen) {
      setTimeout(() => editor?.view.dom.blur(), 50)
    }
    setProfileModalOpen(true)
  }, [isKeyboardOpen, editor, setProfileModalOpen])

  // Mobile doesn't render DocTitle, so remote title changes need their own
  // listener here. The ref keeps the handler on the latest metadata without
  // re-subscribing the effect on every metadata change.
  const metadataRef = useRef(metadata)
  metadataRef.current = metadata

  // Set by "Done" so focus lands on the title (not <body>) once the read cluster remounts.
  const focusTitleAfterExitRef = useRef(false)

  useEffect(() => {
    if (!hocuspocusProvider) return

    const handler = ({ payload }: StatelessPayloadEvent) => {
      try {
        const msg = JSON.parse(payload) as DocTitleMessage
        if (msg.type === 'docTitle') {
          setWorkspaceSetting('metadata', { ...metadataRef.current, title: msg.state.title })
        }
      } catch {
        /* ignore malformed payloads */
      }
    }

    hocuspocusProvider.on('stateless', handler)
    return () => hocuspocusProvider.off('stateless', handler)
  }, [hocuspocusProvider, setWorkspaceSetting])

  const handleTitleClick = () => {
    openDialog(<TitleEditContent />, { size: 'sm', align: 'top', className: 'mt-14' })
  }

  // Unlike the sheet path, "Done" releases edit mode unconditionally (iOS can still have the keyboard
  // up before `isKeyboardOpen` flips) and re-homes focus to the title.
  const exitEditMode = useCallback(() => {
    focusTitleAfterExitRef.current = true
    releasePadEditMode()
  }, [])

  return (
    <>
      <header className="bg-base-100 sticky top-0 left-0 z-30 w-full">
        <div className="border-base-300 flex min-h-12 w-full flex-col border-b px-2 py-2">
          <div className="flex w-full items-center justify-between gap-2">
            {/* Keyed so the read↔edit control swap crossfades (opacity only:
                the sticky header rides the visualViewport machinery) */}
            <div
              key={isEditable ? 'edit' : 'read'}
              className="flex min-w-0 flex-1 items-center gap-1 motion-safe:animate-[doc-content-in_120ms_ease-out_both]">
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
                  {metadata?.title || 'Untitled'}
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <ProviderSyncStatus disconnectedOnly />
              <PrivateIndicator />
              <ReadOnlyIndicator />
              {user && <NotificationButton />}
              <UserProfileButton
                user={user}
                onProfileClick={user ? handleProfileOpen : () => openInlineSignInDialog()}
              />
            </div>
          </div>

          <div className="w-full">
            <FilterBar displayRestButton />
          </div>
        </div>
      </header>

      {user && (
        <Modal open={isProfileModalOpen} onOpenChange={setProfileModalOpen}>
          <ModalContent size="4xl" mobileTakeover aria-label="Settings" className="p-0">
            <SettingsPanel onClose={() => setProfileModalOpen(false)} />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

export default MobilePadTitle
