import { PanelSurfaceShell } from '@components/PanelSurfaceShell'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'
import { ScrollArea } from '@components/ui/ScrollArea'
import Textarea from '@components/ui/Textarea'
import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import { useDocumentAccessMutation } from '@hooks/useDocumentAccessMutation'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import { downloadAsMarkdown, importMarkdownFile } from '@utils/markdown'
import Image from 'next/image'
import React, { useState } from 'react'
import { TagsInput } from 'react-tag-input-component'

import ToggleSection from '../ToggleSection'

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
  const handleClose = onClose || popoverState.close
  const isSheet = variant === 'sheet'
  const user = useAuthStore((state) => state.profile)
  const editor = useStore((state) => state.settings.editor.instance)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const docMetadata = useStore((state) => state.settings.metadata)
  const editingLocked = useStore((state) => selectDocumentEditingLocked(state.settings, user?.id))

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
                placeholder="Enter document description..."
                rows={3}
              />

              <div>
                <label
                  htmlFor="docKeywords"
                  className="text-base-content mb-2 block text-sm font-medium">
                  Keywords
                </label>
                <span className="documentKeywordInput">
                  <TagsInput
                    value={tags}
                    onChange={handleTagsChange}
                    name="tags"
                    placeHolder="Type keyword..."
                  />
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <Button variant="primary" loading={isPending} onClick={saveDescriptionHandler}>
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input type="radio" className="peer" name="gear-accordion" />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <Icons.fileText size={16} className="text-base-content/50" />
            Markdown
          </div>
          <div className="collapse-content border-base-300 border-t px-4 pt-4">
            <p className="text-base-content/60 mb-4 text-xs">
              Import a Markdown file to replace the current document, or export the document as
              Markdown.
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={!editor || editingLocked}
                className="border-base-300 flex-1 border"
                onClick={async () => {
                  if (!editor) return
                  const { ok, error } = await importMarkdownFile(editor)
                  if (ok) toast.Success('Markdown imported')
                  else if (error) toast.Error(error)
                }}>
                <Icons.upload size={14} />
                Import .md
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!editor || (!docMetadata.title && editor.isEmpty)}
                className="border-base-300 flex-1 border"
                onClick={() => {
                  if (!editor) return
                  downloadAsMarkdown(editor, docMetadata.title || '')
                }}>
                <Icons.download size={14} />
                Export .md
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <PanelSurfaceShell
      variant={variant}
      title="Settings"
      fillHeight
      bodyClassName="min-h-0 overflow-hidden"
      className={className}
      popoverHeader={
        <div className="flex items-center justify-between">
          <h2 className="text-base-content text-lg font-semibold">Settings</h2>
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
