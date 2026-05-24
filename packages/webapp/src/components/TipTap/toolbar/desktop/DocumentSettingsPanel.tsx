import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { usePopoverState } from '@components/ui/Popover'
import { ScrollArea } from '@components/ui/ScrollArea'
import Textarea from '@components/ui/Textarea'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import { Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import { type PanelSurfaceVariant } from '@types'
import { downloadAsMarkdown, importMarkdownFile } from '@utils/markdown'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import { TagsInput } from 'react-tag-input-component'
import { twMerge } from 'tailwind-merge'

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
  const hocuspocusProvider = useStore((state) => state.settings.hocuspocusProvider)
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const docMetadata = useStore((state) => state.settings.metadata)

  const [docDescription, setDocDescription] = useState(docMetadata.description || '')
  const { isPending, isSuccess, mutate } = useUpdateDocMetadata()
  const [tags, setTags] = useState<string[]>(docMetadata.keywords || [])
  const [readOnly, setReadOnly] = useState(docMetadata.readOnly || false)
  const [formTargetHandler, setFormTargetHandler] = useState('description')

  const saveDescriptionHandler = () => {
    mutate({ documentId: docMetadata.documentId, description: docDescription, keywords: tags })
  }

  const saveDocReadOnlyHandler = () => {
    setReadOnly(() => {
      setFormTargetHandler('readOnly')
      hocuspocusProvider.sendStateless(JSON.stringify({ type: 'readOnly', state: !readOnly }))
      mutate({ documentId: docMetadata.documentId, readOnly: !readOnly })
      return !readOnly
    })
  }

  const handleTagsChange = (newTags: string[]) => {
    setTags(newTags)
  }

  useEffect(() => {
    if (isSuccess) {
      if (formTargetHandler === 'readOnly') toast.Success('Read-only status updated')
      else toast.Success('Description and keywords updated')
    }
  }, [isSuccess, formTargetHandler])

  const isOwner = user?.id === docMetadata?.ownerId
  const ownerProfile = docMetadata?.ownerProfile
  const showOwnerHeader = ownerProfile && isAuthServiceAvailable

  const settingsBody = (
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
              <Button
                variant="primary"
                loading={formTargetHandler === 'description' && isPending}
                onClick={saveDescriptionHandler}>
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
              disabled={!editor}
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
  )

  return (
    <div
      className={twMerge(
        'bg-base-100 flex w-full flex-col',
        isSheet && 'min-h-0 flex-1 overflow-hidden',
        className
      )}>
      <div className="border-base-300 shrink-0 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base-content text-lg font-semibold">Settings</h2>
          {!isSheet && <CloseButton onClick={handleClose} size="sm" />}
        </div>
      </div>

      {showOwnerHeader && (
        <div className="bg-base-200 border-base-300 flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <Image
            className="border-base-300 size-8 shrink-0 rounded-full border"
            src={ownerProfile.avatar_url || ownerProfile.default_avatar_url}
            height={32}
            width={32}
            alt={ownerProfile.full_name}
            title={ownerProfile.full_name}
          />
          <div className="min-w-0 flex-1">
            <p className="text-base-content/50 text-[10px] font-medium tracking-wide uppercase">
              Owned by
            </p>
            <p className="text-base-content truncate text-sm font-medium">
              {ownerProfile.full_name}
            </p>
          </div>
          {isOwner ? (
            <ToggleSection
              name="Read-only"
              description="Make this document read-only for viewers"
              checked={readOnly}
              onChange={saveDocReadOnlyHandler}
              className="py-0"
            />
          ) : (
            <span
              className={`badge badge-sm badge-soft shrink-0 ${
                readOnly ? 'badge-error' : 'badge-success'
              }`}>
              {readOnly ? 'Read-only' : 'Editable'}
            </span>
          )}
        </div>
      )}

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
    </div>
  )
}

export default DocumentSettingsPanel
