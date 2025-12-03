import React, { useState, useEffect } from 'react'
import Button from '@components/ui/Button'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'
import { saveDocDescriptionHandler, saveDocReadOnlyPage } from './toolbarUtils'
import Toggle from '@components/ui/Toggle'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { useAuthStore, useStore, useEditorPreferences } from '@stores'
import { Gear } from '@icons'
import { TagsInput } from 'react-tag-input-component'
import { TbPageBreak } from 'react-icons/tb'
import { HiOutlineDocumentText } from 'react-icons/hi'

const ToggleSection = ({ name, className, description, value, checked, onChange }: any) => {
  const containerClasses = twMerge(`flex flex-col p-2 antialiased `, className)

  return (
    <div className={containerClasses}>
      <p className="text-base font-bold">{name}</p>
      <div className="flex w-full flex-row items-center justify-between align-middle">
        <p className="text-sm text-gray-500">{description}</p>
        <div className="mr-6 ml-2 h-full flex-col border-l px-3 py-2">
          <Toggle id={value} checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

const GearModal = ({ className }: any) => {
  const user = useAuthStore((state) => state.profile)
  const {
    hocuspocusProvider,
    isAuthServiceAvailable,
    metadata: docMetadata
  } = useStore((state) => state.settings)

  // Editor preferences from store (persisted in localStorage)
  const { preferences, togglePreference } = useEditorPreferences()

  const [docDescription, setDocDescription] = useState(docMetadata.description)
  const { isLoading, isSuccess, mutate } = useUpdateDocMetadata()
  const [tags, setTags] = useState(docMetadata.keywords)
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
      if (formTargetHandler === 'readOnly') toast.success('Read-only status updated')
      else toast.success('Description and keywords updated')
    }
  }, [isSuccess])

  const toggleIndentSetting = () => togglePreference('indentHeading')
  const toggleH1SectionBreakSetting = () => togglePreference('h1SectionBreak')

  const OwnerProfile = () => {
    const { full_name, username } = docMetadata.ownerProfile

    return (
      <div className="mt-2 rounded-md border p-2 antialiased">
        <p className="font-bold">Document Owner: </p>

        <div className="flex items-center justify-between align-baseline">
          <div className="mt-1 ml-2">
            <p className="text-sm">
              <b>Name: </b>
              {full_name}
            </p>
            {username && (
              <p className="text-xs text-gray-500">
                <b>Username: </b>
                {username}
              </p>
            )}
          </div>
          {/* <p className="font-semibold text-gray-400 underline underline-offset-1"> Public document</p> */}

          <Image
            className="size-9 rounded-full border-2"
            src={
              docMetadata?.ownerProfile?.avatar_url || docMetadata?.ownerProfile?.default_avatar_url
            }
            height={32}
            width={32}
            alt={full_name}
            title={full_name}
          />
        </div>
        {user?.id === docMetadata?.ownerId && (
          <div className="mt-4 border-t">
            <ToggleSection
              name="Read-only"
              description="Enable to make document read-only"
              checked={readOnly}
              onChange={saveDocreadOnlyHandler}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={twMerge('gearModal text-neutral', className)}>
      <div className="mb-4 flex items-center align-middle">
        <div>
          <p className="m-0 flex items-center space-x-1 font-semibold">
            <Gear size={18} className="mr-1 ml-1" fill="rgba(42,42,42)" />
            <span>Settings</span>
          </p>
          <small className="pl-1 text-gray-400">Document settings and preferences</small>
        </div>
      </div>

      <div className="collapse-arrow bg-base-200 collapse">
        <input type="radio" className="peer" name="gear-pear" />
        <div className="collapse-title flex items-center p-0 text-sm font-semibold">
          <TbPageBreak className="mx-2 ml-3" size={18} />
          Page Preferences
        </div>
        <div className="collapse-content !pb-0">
          <div className="card-body p-0">
            <ToggleSection
              name="Heading Indentation"
              description="Turn on to indent headings for better readability"
              checked={preferences.indentHeading}
              onChange={toggleIndentSetting}
            />
            <ToggleSection
              name="H1 Section Break"
              description="Enable to insert a break after H1 headings for clear separation"
              checked={preferences.h1SectionBreak}
              onChange={toggleH1SectionBreakSetting}
            />
          </div>
        </div>
      </div>

      <div className="collapse-arrow bg-base-200 collapse mt-3">
        <input type="radio" className="peer" name="gear-pear" defaultChecked />
        <div className="collapse-title flex items-center p-0 text-sm font-semibold">
          <HiOutlineDocumentText className="mx-2 ml-3" size={18} />
          Document Preferences
        </div>
        <div className="collapse-content !pb-0">
          <div className="card-body p-0 pb-2">
            <div className="">
              <label htmlFor="docDescription" className="mb-1 block text-sm font-medium">
                Description
              </label>
              <textarea
                id="docDescription"
                className="textarea textarea-bordered w-full"
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                placeholder="Enter document description..."></textarea>
            </div>
            <div>
              <label htmlFor="docKeywords" className="mb-1 block text-sm font-medium">
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
            <div className="mt-4 flex justify-end">
              <Button
                loading={formTargetHandler === 'description' && isLoading}
                className="bg btn btn-neutral btn-sm"
                onClick={saveDescriptionHandler}>
                Save Preferences
              </Button>
            </div>
          </div>
          <div className="max-w-md">
            {docMetadata.ownerProfile && isAuthServiceAvailable && (
              <div>
                <OwnerProfile />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default GearModal
