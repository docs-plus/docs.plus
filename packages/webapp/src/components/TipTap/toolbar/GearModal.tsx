import React, { useState, useEffect } from 'react'
import Button from '@components/ui/Button'
import Textarea from '@components/ui/Textarea'
import CloseButton from '@components/ui/CloseButton'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import * as toast from '@components/toast'
import { saveDocDescriptionHandler, saveDocReadOnlyPage } from './toolbarUtils'
import Toggle from '@components/ui/Toggle'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { useAuthStore, useStore, useEditorPreferences } from '@stores'
import { LuSquareSplitVertical, LuFileText } from 'react-icons/lu'
import { TagsInput } from 'react-tag-input-component'
import { usePopoverState } from '@components/ui/Popover'

interface ToggleSectionProps {
  name: string
  className?: string
  description: string
  value?: string
  checked: boolean
  onChange: () => void
}

const ToggleSection = ({
  name,
  className,
  description,
  value,
  checked,
  onChange
}: ToggleSectionProps) => {
  return (
    <div className={twMerge('flex items-center justify-between gap-4 py-3', className)}>
      <div className="min-w-0 flex-1">
        <p className="text-base-content text-sm font-medium">{name}</p>
        <p className="text-base-content/50 text-xs">{description}</p>
      </div>
      <Toggle
        id={value}
        checked={checked}
        onChange={() => onChange()}
        size="sm"
        variant="primary"
      />
    </div>
  )
}

interface GearModalProps {
  className?: string
  onClose?: () => void
}

const GearModal = ({ className, onClose }: GearModalProps) => {
  const popoverState = usePopoverState()
  const handleClose = onClose || popoverState.close
  const user = useAuthStore((state) => state.profile)
  const {
    hocuspocusProvider,
    isAuthServiceAvailable,
    metadata: docMetadata
  } = useStore((state) => state.settings)

  // Editor preferences from store (persisted in localStorage)
  const { preferences, togglePreference } = useEditorPreferences()

  const [docDescription, setDocDescription] = useState(docMetadata.description || '')
  const { isLoading, isSuccess, mutate } = useUpdateDocMetadata()
  const [tags, setTags] = useState<string[]>(docMetadata.keywords || [])
  const [readOnly, setreadOnly] = useState(docMetadata.readOnly || false)
  const [formTargetHandler, setFormTargetHndler] = useState('description')

  // Save document description
  const saveDescriptionHandler = () => {
    saveDocDescriptionHandler(mutate, docMetadata.documentId, docDescription, tags)
  }

  const saveDocreadOnlyHandler = () => {
    setreadOnly(() => {
      setFormTargetHndler('readOnly')
      hocuspocusProvider.sendStateless(JSON.stringify({ type: 'readOnly', state: !readOnly }))
      saveDocReadOnlyPage(mutate, docMetadata.documentId, !readOnly)
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
  }, [isSuccess])

  const toggleIndentSetting = () => togglePreference('indentHeading')
  const toggleH1SectionBreakSetting = () => togglePreference('h1SectionBreak')

  const OwnerProfile = () => {
    const { full_name, username } = docMetadata.ownerProfile

    return (
      <div className="rounded-box border-base-300 bg-base-200/50 mt-4 border p-4">
        <div className="mb-3 flex items-center gap-3">
          <Image
            className="border-base-100 size-10 rounded-full border-2"
            src={
              docMetadata?.ownerProfile?.avatar_url || docMetadata?.ownerProfile?.default_avatar_url
            }
            height={40}
            width={40}
            alt={full_name}
            title={full_name}
          />
          <div className="min-w-0 flex-1">
            <p className="text-base-content truncate text-sm font-medium">{full_name}</p>
            {username && <p className="text-base-content/50 truncate text-xs">@{username}</p>}
          </div>
        </div>
        {user?.id === docMetadata?.ownerId && (
          <div className="border-base-300 border-t pt-3">
            <ToggleSection
              name="Read-only"
              description="Make this document read-only for viewers"
              checked={readOnly}
              onChange={saveDocreadOnlyHandler}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={twMerge('bg-base-100 flex w-full flex-col', className)}>
      {/* Header */}
      <div className="border-base-300 border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base-content text-lg font-semibold">Settings</h2>
          <CloseButton onClick={handleClose} size="sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 p-4">
        {/* Page Preferences */}
        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input type="radio" className="peer" name="gear-accordion" />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <LuSquareSplitVertical size={16} className="text-base-content/50" />
            Page Preferences
          </div>
          <div className="collapse-content border-base-300 border-t px-4">
            <div className="divide-base-300 divide-y">
              <ToggleSection
                name="Heading Indentation"
                description="Indent headings for better readability"
                checked={preferences.indentHeading}
                onChange={toggleIndentSetting}
              />
              <ToggleSection
                name="H1 Section Break"
                description="Insert a break after H1 headings"
                checked={preferences.h1SectionBreak}
                onChange={toggleH1SectionBreakSetting}
              />
            </div>
          </div>
        </div>

        {/* Document Preferences */}
        <div className="collapse-arrow rounded-box border-base-300 bg-base-100 collapse border">
          <input type="radio" className="peer" name="gear-accordion" defaultChecked />
          <div className="collapse-title text-base-content flex items-center gap-2 font-medium">
            <LuFileText size={16} className="text-base-content/50" />
            Document Preferences
          </div>
          <div className="collapse-content border-base-300 border-t px-4 pt-4">
            <div className="flex flex-col gap-4">
              {/* Description */}
              <Textarea
                id="docDescription"
                label="Description"
                labelPosition="above"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Enter document description..."
                rows={3}
              />

              {/* Keywords */}
              <div>
                <label
                  htmlFor="docKeywords"
                  className="text-base-content mb-2 block text-sm font-medium">
                  Keywords
                </label>
                <span className="documentKeywordTnput">
                  <TagsInput
                    value={tags}
                    onChange={handleTagsChange}
                    name="tags"
                    placeHolder="Type keyword..."
                  />
                </span>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  variant="primary"
                  loading={formTargetHandler === 'description' && isLoading}
                  onClick={saveDescriptionHandler}>
                  Save Changes
                </Button>
              </div>

              {/* Owner Profile */}
              {docMetadata.ownerProfile && isAuthServiceAvailable && <OwnerProfile />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GearModal
