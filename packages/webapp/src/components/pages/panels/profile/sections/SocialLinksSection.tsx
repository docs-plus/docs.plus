import React, { useState, useEffect } from 'react'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import { ILinkItem } from '../types'
import { useAddLink } from '../hooks/useAddLink'
import LinkItems from '../components/LinkItems'
import { Profile } from '@types'
import * as toast from '@components/toast'
import { useProfileUpdate } from '../hooks/useProfileUpdate'

const Linktree: React.FC = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  const [links, setLinks] = useState<ILinkItem[]>(
    (user?.profile_data?.linkTree ?? []) as ILinkItem[]
  )
  const [newLink, setNewLink] = useState<string>('')
  const [showDescription, setShowDescription] = useState<{ [key: string]: boolean }>({})

  const { addLink, loading } = useAddLink()
  const { loading: updateLoading, handleSave } = useProfileUpdate()

  const handleAddLink = async () => {
    if (!user) return
    const { error, link } = await addLink(newLink)
    if (error) {
      toast.Error('Add link failed: ' + error)
      console.error(error)
      return
    }
    if (!link) return
    // check if the link is already in the list
    if (links.some((l) => l.url === link.url)) {
      toast.Warning('Link already exists!')
      return
    }
    setLinks((prev) => [...prev, link])
    setNewLink('')
    const newLinkTree = [...(user.profile_data?.linkTree ?? []), link]
    setProfile({
      ...user,
      profile_data: { ...user.profile_data, linkTree: newLinkTree }
    } as Profile)

    handleSave({ successToast: 'Link added successfully!' })
  }

  const handleRemoveLink = (url: string) => {
    if (!user) return
    const newLinkTree = links.filter((link) => link.url !== url)
    setLinks(newLinkTree)
    setProfile({
      ...user,
      profile_data: { ...user.profile_data, linkTree: newLinkTree }
    } as Profile)
    handleSave({ successToast: 'Link removed successfully!' })
  }

  const toggleDescription = (url: string) => {
    setShowDescription((prev) => ({
      ...prev,
      [url]: !prev[url]
    }))
  }

  return (
    <div className="flex flex-col">
      <div className="mt-4">
        <InputOverlapLabel
          label="Add URL, social media, or phone number"
          value={newLink}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLink(e.target.value)}
          disabled={loading || updateLoading}
        />
        <Button
          className="btn-outline btn-block mt-2"
          onClick={handleAddLink}
          loading={loading || updateLoading}
          disabled={loading || updateLoading}
          loadingText={loading ? 'fetching url metadata' : updateLoading ? 'saving link' : ''}>
          Add Link
        </Button>
      </div>

      <div className="my-8 flex items-center">
        <div className="h-px flex-1 bg-gray-200"></div>
        <span className="mx-4 text-sm font-medium text-gray-500">Your Links</span>
        <div className="h-px flex-1 bg-gray-200"></div>
      </div>

      <LinkItems
        links={links}
        showDescription={showDescription}
        toggleDescription={toggleDescription}
        handleRemoveLink={handleRemoveLink}
      />
    </div>
  )
}

export default Linktree
