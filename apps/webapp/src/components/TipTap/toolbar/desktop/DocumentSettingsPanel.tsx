import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import { SheetPrimaryFooter } from '@components/SheetPrimaryFooter'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import { ScrollArea } from '@components/ui/ScrollArea'
import Textarea from '@components/ui/Textarea'
import { canEditDocumentMetadata } from '@hooks/canEditDocumentMetadata'
import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useDismissPanel } from '@hooks/useDismissPanel'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import React, { useState } from 'react'

import { useDocumentFollow } from '../useDocumentFollow'
import { DocumentAccessWell } from './DocumentAccessWell'
import { documentSettingsRows } from './documentSettingsRows'
import ImportExportSection from './ImportExportSection'
import { KeywordTagsField } from './KeywordTagsField'

interface DocumentSettingsPanelProps {
  variant?: PanelSurfaceVariant
}

const DocumentSettingsPanel = ({ variant = 'popover' }: DocumentSettingsPanelProps) => {
  const dismissPanel = useDismissPanel(variant)
  const isSheet = variant === 'sheet'
  const user = useAuthStore((state) => state.profile)
  const editor = useStore((state) => state.settings.editor.instance)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const docMetadata = useStore((state) => state.settings.metadata)
  const joinedWorkspace = useStore((state) => state.settings.workspaceJoin === 'joined')
  const editingLocked = useStore((state) => selectDocumentEditingLocked(state.settings, user?.id))
  const profileId = useAuthStore((state) => state.profile?.id ?? state.session?.id)
  const canEditMetadata = useStore((state) => canEditDocumentMetadata(state.settings, profileId))

  const [docDescription, setDocDescription] = useState(docMetadata.description || '')
  const { isPending, mutate } = useUpdateDocMetadata()
  const [tags, setTags] = useState<string[]>(docMetadata.keywords || [])
  const { setPrivate, setReadOnly, isControlDisabled } = useDocumentAccessMutation({
    documentId: docMetadata.documentId,
    userId: user?.id,
    isPrivate: Boolean(docMetadata.isPrivate),
    readOnly: Boolean(docMetadata.readOnly)
  })

  const rows = documentSettingsRows({
    userId: user?.id,
    isAuthServiceAvailable,
    metadata: docMetadata
  })
  const { following, canToggle, toggle, readPending } = useDocumentFollow({
    documentId: docMetadata.documentId,
    // Membership, not sign-in. join_workspace writes the row the RPC matches,
    // so a read before it lands answers null and paints a false "off".
    enabled: rows.showFollow && joinedWorkspace
  })

  const saveDescriptionHandler = () => {
    mutate(
      {
        documentId: docMetadata.documentId,
        description: docDescription,
        keywords: tags,
        slug: docMetadata.slug
      },
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
    dismissPanel()
    setTimeout(() => window.print(), isSheet ? 320 : 100)
  }

  const softWell = (
    <DocumentAccessWell
      rows={rows}
      access={{ setPrivate, setReadOnly, isControlDisabled }}
      // A pending read paints "on", so the switch is a bone while the read is in flight.
      follow={
        readPending
          ? undefined
          : {
              checked: following,
              // `set_document_follow` is UPDATE-only, so it needs the membership row first.
              disabled: !joinedWorkspace || !canToggle,
              onChange: () => void toggle()
            }
      }
    />
  )

  const settingsBody = (
    <div className="flex flex-col">
      {softWell}
      <div className="flex flex-col gap-4 p-4">
        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input
            type="radio"
            className="peer"
            name="gear-accordion"
            aria-label="Document preferences"
            defaultChecked
          />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <Icons.fileText size={16} className="text-base-content/50" />
            Document preferences
          </div>
          <div className="collapse-content border-base-300 px-4 peer-checked:border-t peer-checked:pt-4">
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
                    size="sm"
                    loading={isPending}
                    disabled={!canEditMetadata}
                    onClick={saveDescriptionHandler}>
                    Save details
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input type="radio" className="peer" name="gear-accordion" aria-label="Import & export" />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <Icons.download size={16} className="text-base-content/50" />
            Import & export
          </div>
          <div className="collapse-content border-base-300 px-4 peer-checked:border-t peer-checked:pt-4">
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
      className="max-h-[inherit]"
      footer={
        isSheet ? (
          <SheetPrimaryFooter
            label="Save details"
            onClick={saveDescriptionHandler}
            disabled={!canEditMetadata}
            loading={isPending}
          />
        ) : undefined
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
        <div className="min-h-0 overflow-y-auto">{settingsBody}</div>
      )}
    </PanelSurfaceShell>
  )
}

export default DocumentSettingsPanel
