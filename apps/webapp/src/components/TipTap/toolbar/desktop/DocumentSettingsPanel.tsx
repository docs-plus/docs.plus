import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { SheetPrimaryFooter } from '@components/SheetPrimaryFooter'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'
import { ScrollArea } from '@components/ui/ScrollArea'
import Textarea from '@components/ui/Textarea'
import { canEditDocumentMetadata } from '@hooks/canEditDocumentMetadata'
import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useDismissPanel } from '@hooks/useDismissPanel'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { Icons } from '@icons'
import { useAuthStore, useSheetStore, useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import Image from 'next/image'
import React, { useState } from 'react'

import ToggleSection from '../ToggleSection'
import { useDocumentFollow } from '../useDocumentFollow'
import ImportExportSection from './ImportExportSection'
import { KeywordTagsField } from './KeywordTagsField'

interface DocumentSettingsPanelProps {
  className?: string
  onClose?: () => void
  variant?: PanelSurfaceVariant
}

const DocumentSettingsPanel = ({
  className,
  onClose,
  variant = 'popover'
}: DocumentSettingsPanelProps) => {
  const popoverState = usePopoverState()
  const dismissPanel = useDismissPanel(variant)
  const handleClose = onClose ?? (variant === 'sheet' ? dismissPanel : popoverState.close)
  const isSheet = variant === 'sheet'
  const user = useAuthStore((state) => state.profile)
  const editor = useStore((state) => state.settings.editor.instance)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const docMetadata = useStore((state) => state.settings.metadata)
  const joinedWorkspace = useStore((state) => state.settings.joinedWorkspace)
  const editingLocked = useStore((state) => selectDocumentEditingLocked(state.settings, user?.id))
  const canEditMetadata = useStore((state) => canEditDocumentMetadata(state.settings, user?.id))

  const [docDescription, setDocDescription] = useState(docMetadata.description || '')
  const { isPending, mutate } = useUpdateDocMetadata()
  const [tags, setTags] = useState<string[]>(docMetadata.keywords || [])
  const { setPrivate, setReadOnly, isControlDisabled } = useDocumentAccessMutation({
    documentId: docMetadata.documentId,
    userId: user?.id,
    isPrivate: Boolean(docMetadata.isPrivate),
    readOnly: Boolean(docMetadata.readOnly)
  })

  const isPrivate = Boolean(docMetadata.isPrivate)
  const readOnly = Boolean(docMetadata.readOnly)
  const isOwner = Boolean(user?.id && user.id === docMetadata?.ownerId)
  const identity = isAuthServiceAvailable ? docMetadata?.ownerProfile : undefined
  const canFollow = Boolean(isAuthServiceAvailable && user?.id)
  const { following, canToggle, toggle } = useDocumentFollow({
    documentId: docMetadata.documentId,
    // Membership, not sign-in. join_workspace writes the row the RPC matches,
    // so a read before it lands answers null and paints a false "off".
    enabled: canFollow && Boolean(joinedWorkspace)
  })

  const saveDescriptionHandler = () => {
    mutate(
      { documentId: docMetadata.documentId, description: docDescription, keywords: tags },
      {
        onSuccess: () => toast.Success('Description and keywords updated')
      }
    )
  }

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags)
  }

  // Print snapshots the DOM the moment it is called, so let the surface finish closing first —
  // the sheet's spring runs longer than the popover's fade.
  const handlePrint = () => {
    if (isSheet) useSheetStore.getState().closeSheet()
    else handleClose()
    setTimeout(() => window.print(), isSheet ? 320 : 100)
  }

  const softWell = (
    <div className="bg-base-200 border-base-300 flex flex-col border-b">
      {identity ? (
        <div className="flex items-center gap-3 px-4 py-3">
          <Image
            className="border-base-300 size-8 shrink-0 rounded-full border"
            src={identity.avatar_url || identity.default_avatar_url}
            height={32}
            width={32}
            alt={identity.full_name}
            title={identity.full_name}
          />
          <div className="min-w-0 flex-1">
            <p className="text-base-content/50 text-[10px] font-medium tracking-wide uppercase">
              Owned by
            </p>
            <p className="text-base-content truncate text-sm font-medium">{identity.full_name}</p>
          </div>
        </div>
      ) : null}
      {identity ? <div className="border-base-300 border-t" /> : null}
      <div className="flex flex-col px-4 py-2">
        {isOwner && isAuthServiceAvailable ? (
          <>
            <ToggleSection
              name="Private"
              description="Only you can open this document."
              checked={isPrivate}
              disabled={isControlDisabled('isPrivate')}
              onChange={() => setPrivate(!isPrivate)}
              className="min-h-11 py-2 sm:min-h-0"
            />
            <ToggleSection
              name="Read-only"
              description={
                isPrivate
                  ? 'Not used while the document is private.'
                  : 'Viewers can’t edit this document.'
              }
              checked={readOnly}
              disabled={isControlDisabled('readOnly')}
              onChange={() => setReadOnly(!readOnly)}
              className="min-h-11 py-2 sm:min-h-0"
            />
          </>
        ) : (
          <div className="flex flex-wrap gap-2 py-2">
            <span className="badge badge-sm badge-soft">{isPrivate ? 'Private' : 'Public'}</span>
            <span className="badge badge-sm badge-soft">{readOnly ? 'Read-only' : 'Editable'}</span>
          </div>
        )}
        {canFollow ? (
          <ToggleSection
            name="Follow"
            description="Notify me when this document changes."
            checked={following}
            // `set_document_follow` is UPDATE-only, so it needs the membership row first.
            disabled={!joinedWorkspace || !canToggle}
            onChange={() => void toggle()}
            className="min-h-11 py-2 sm:min-h-0"
          />
        ) : null}
      </div>
    </div>
  )

  const settingsBody = (
    <div className="flex flex-col">
      {softWell}
      <div className="flex flex-col gap-4 p-4">
        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input type="radio" className="peer" name="gear-accordion" defaultChecked />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <Icons.fileText size={16} className="text-base-content/50" />
            Document Preferences
          </div>
          <div className="collapse-content border-base-300 border-t px-4 pt-4">
            <div className="flex flex-col gap-4">
              <Textarea
                id="docDescription"
                label="Description"
                labelPosition="above"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder={
                  canEditMetadata
                    ? 'Enter document description...'
                    : 'Only the owner can edit this document’s details.'
                }
                disabled={!canEditMetadata}
                rows={3}
              />

              <KeywordTagsField
                value={tags}
                onChange={handleTagsChange}
                disabled={!canEditMetadata}
                placeholder={canEditMetadata ? 'Type a keyword…' : ''}
              />

              {isSheet ? null : (
                <div className="flex justify-end pt-2">
                  <Button
                    variant="primary"
                    loading={isPending}
                    disabled={!canEditMetadata}
                    onClick={saveDescriptionHandler}>
                    Save Changes
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input type="radio" className="peer" name="gear-accordion" />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <Icons.download size={16} className="text-base-content/50" />
            Import & export
          </div>
          <div className="collapse-content border-base-300 border-t px-4 pt-4">
            <ImportExportSection
              editor={editor}
              documentId={docMetadata.documentId}
              documentTitle={docMetadata.title || ''}
              editingLocked={editingLocked}
              isSheet={isSheet}
              onPrint={handlePrint}
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Document settings"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      className={className}
      onClose={isSheet ? handleClose : undefined}
      footer={
        isSheet ? (
          <SheetPrimaryFooter
            label="Save"
            onClick={saveDescriptionHandler}
            disabled={!canEditMetadata || isPending}
          />
        ) : undefined
      }
      popoverHeader={
        <div className="flex items-center justify-between">
          <h2 className="text-base-content text-lg font-semibold">Document settings</h2>
          <CloseButton onClick={handleClose} size="sm" />
        </div>
      }>
      {isSheet ? (
        <ScrollArea
          className="min-h-0 flex-1"
          scrollbarSize="thin"
          hideScrollbar
          preserveWidth={false}>
          {settingsBody}
        </ScrollArea>
      ) : (
        settingsBody
      )}
    </PanelSurfaceShell>
  )
}

export default DocumentSettingsPanel
