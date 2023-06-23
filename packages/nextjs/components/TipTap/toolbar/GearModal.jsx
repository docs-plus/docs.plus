import React, { useState, useEffect } from 'react'
import TextAreaOvelapLabel from '../../TextAreaOvelapLabel'
import InputTags from '../../InputTags'
import Button from '../../Button'
import useUpdateDocMetadata from '../../../hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'
import { useBooleanLocalStorageState, saveDocDescriptionHandler } from './toolbarUtils'
import Toggle from '../../Toggle'
import Image from 'next/image'

const ToggleSection = ({ name, description, value, checked, onChange }) => {
  return (
    <div className="flex flex-col p-2 antialiased ">
      <p className="text-base font-bold">{name}</p>
      <div className="flex w-full flex-row align-middle justify-between items-center">
        <p className="text-gray-500 text-sm">{description}</p>
        <div className="border-l flex-col h-full py-4 px-4 ml-2 mr-6">
          <Toggle id={value} checked={checked} onChange={onChange} />
        </div>
      </div>
    </div>
  )
}

const GearModal = ({ docMetadata }) => {
  const [indentSetting, setIndentSetting] = useBooleanLocalStorageState('setting.indentHeading', false)
  const [h1SectionBreakSetting, setH1SectionBreakSetting] = useBooleanLocalStorageState(
    'setting.h1SectionBreakSetting',
    true
  )
  const [docDescription, setDocDescription] = useState(docMetadata.description)

  const { isLoading, isSuccess, mutate } = useUpdateDocMetadata()
  const [tags, setTags] = useState(docMetadata.keywords)

  // Save document description
  const saveDescriptionHandler = (e) => {
    saveDocDescriptionHandler(mutate, docMetadata.documentId, docDescription, tags)
  }

  const handleTagsChange = (newTags) => {
    setTags(newTags)
  }

  useEffect(() => {
    if (isSuccess) {
      toast.success('Description updated')
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
    const user = docMetadata.ownerProfile
    const lastUpdate = Date.now().toString()

    let avatar = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/public/${user.id}.png?${lastUpdate}`
    if (user.avatar_url) avatar = user.avatar_url

    return (
      <div className="antialiased  mt-2 border p-2 rounded-md">
        <p className="font-bold">Document Owner: </p>
        <div className="flex align-baseline justify-between">
          <div className="mt-1 ml-2">
            <p className="text-sm">
              <b>Name: </b>
              {user.full_name}
            </p>
            <p className="text-xs text-gray-500">
              <b>Username: </b>
              {user.username}
            </p>
          </div>
          <p className="font-semibold text-gray-400 underline underline-offset-1"> Public document</p>
        </div>

        {/*
        <Image
          className="w-8 h-9 border-2 rounded-full"
          src={avatar}
          width={32}
          height={32}
          alt={user.full_name}
          // fill={true}
          title={user.full_name}
        /> */}
      </div>
    )
  }

  return (
    <div className="gearModal nd_modal">
      <p className="font-medium text-base text-gray-400 pb-1">Settings:</p>
      <hr />
      {docMetadata.ownerProfile && (
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
        <Button loading={isLoading} className="!w-32 !mt-3" onClick={saveDescriptionHandler}>
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
  )
}

export default GearModal
