import React, { useState, useEffect } from 'react'
import TextAreaOvelapLabel from '@components/ui/TextAreaOvelapLabel'
import InputTags from '@components/ui/InputTags'
import Button from '@components/ui/Button'
import useUpdateDocMetadata from '@hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'
import {
  useBooleanLocalStorageState,
  saveDocDescriptionHandler,
  saveDocReadOnlyPage
} from './toolbarUtils'
import Toggle from '@components/ui/Toggle'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { useEditorStateContext } from '@context/EditorContext'
import { PopoverContent } from '@components/ui/Popover'
import { useAuthStore } from '@utils/supabase'
import { useDocumentMetadataContext } from '@context/DocumentMetadataContext'

const ToggleSection = ({ name, className, description, value, checked, onChange }) => {
  const containerClasses = twMerge(`flex flex-col p-2 antialiased `, className)

  return (
    <div className={containerClasses}>
      <p className="text-base font-bold">{name}</p>
      <div className="flex w-full flex-row align-middle justify-between items-center">
        <p className="text-gray-500 text-sm">{description}</p>
        <div className="border-l flex-col h-full py-2 px-3 ml-2 mr-6">
          <Toggle id={value} checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

const GearModal = ({ className }) => {
  const docMetadata = useDocumentMetadataContext()

  const user = useAuthStore.use.user()

  const { isAuthServiceAvailable, EditorProvider } = useEditorStateContext()

  const [indentSetting, setIndentSetting] = useBooleanLocalStorageState(
    'setting.indentHeading',
    false
  )
  const [h1SectionBreakSetting, setH1SectionBreakSetting] = useBooleanLocalStorageState(
    'setting.h1SectionBreakSetting',
    true
  )
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
      EditorProvider.sendStateless(JSON.stringify({ type: 'readOnly', state: !readOnly }))
      saveDocReadOnlyPage(mutate, docMetadata.documentId, !readOnly)
      return !readOnly
    })
  }

  const handleTagsChange = (newTags) => {
    setTags(newTags)
  }

  useEffect(() => {
    if (isSuccess) {
      if (formTargetHandler === 'readOnly') toast.success('Read-only status updated')
      else toast.success('Description and keywords updated')
    }
  }, [isSuccess])

  useEffect(() => {
    if (h1SectionBreakSetting) {
      document.body.classList.add('h1SectionBreak')
    } else {
      document.body.classList.remove('h1SectionBreak')
    }
  }, [h1SectionBreakSetting])

  useEffect(() => {
    if (indentSetting) {
      document.body.classList.add('indentHeading')
    } else {
      document.body.classList.remove('indentHeading')
    }
  }, [indentSetting])

  const toggleIndentSetting = () => {
    setIndentSetting(!indentSetting)
  }

  const toggleH1SectionBreakSetting = () => {
    setH1SectionBreakSetting(!h1SectionBreakSetting)
  }

  const OwnerProfile = () => {
    const { full_name, username } = docMetadata.ownerProfile

    return (
      <div className="antialiased  mt-2 border p-2 rounded-md">
        <p className="font-bold">Document Owner: </p>

        <div className="flex align-baseline items-center justify-between">
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
            className="w-9 h-9 border-2 rounded-full"
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
          <div className="border-t mt-4 ">
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
    <PopoverContent className={twMerge('Popover gearModal ', className)}>
      <div className="max-w-md">
        <p className="font-medium  text-base text-gray-400 pb-1">Settings:</p>
        <hr />
        {docMetadata.ownerProfile && isAuthServiceAvailable && (
          <div>
            <OwnerProfile />
          </div>
        )}
        <div className="content pt-5 flex flex-col !items-end">
          <TextAreaOvelapLabel
            label="Document Description"
            value={docDescription}
            onChange={(e) => setDocDescription(e.target.value)}
            className="w-full"
          />
          <div className=" w-full mt-4">
            <InputTags
              label="Document Keywords"
              placeholder="Type keyword..."
              onChangeTags={handleTagsChange}
              defaultTags={tags}></InputTags>
          </div>
          <Button
            loading={formTargetHandler === 'description' && isLoading}
            className="!w-32 !mt-3"
            onClick={saveDescriptionHandler}>
            Save
          </Button>
        </div>
        <hr className="my-2" />

        <ToggleSection
          name="Heading Indentation"
          description="Turn on to indent headings for better readability"
          checked={indentSetting}
          onChange={toggleIndentSetting}
        />
        <ToggleSection
          name="H1 Section Break"
          description="Enable to insert a break after H1 headings for clear separation"
          checked={h1SectionBreakSetting}
          onChange={toggleH1SectionBreakSetting}
        />
      </div>
    </PopoverContent>
  )
}

export default GearModal
