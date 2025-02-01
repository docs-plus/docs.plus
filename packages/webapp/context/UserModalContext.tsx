import React, { createContext, useContext, useEffect, useState } from 'react'
import Modal from '@components/ui/Modal'
import { getUserProfileForModal } from '@api'
import { useSupabase } from '@hooks/useSupabase'
import Loading from '@components/ui/Loading'
import { Avatar } from '@components/ui/Avatar'
import { ILinkItem } from '@components/pages/panels/profile/types'
import { SOCIAL_MEDIA_ICONS } from '@components/pages/panels/profile/constants'
import { IoCloseSharp } from 'react-icons/io5'

type UserModalContextType = {
  openUserModal: (userId: string) => void
  closeUserModal: () => void
}

const UserModalContext = createContext<UserModalContextType | undefined>(undefined)

export function UserModalProvider({ children }: { children: React.ReactNode }) {
  const {
    data: userData,
    loading,
    request,
    setData
    // @ts-ignore
  } = useSupabase(getUserProfileForModal, null, false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openUserModal = async (userId: string) => {
    setIsModalOpen(true)
    await request(userId)
  }

  const closeUserModal = () => {
    setIsModalOpen(false)
    setData(null)
  }

  const getLinkIcon = (link: ILinkItem) => {
    if (link.type === 'email') {
      return (
        <svg
          className="h-5 w-5"
          fill="none"
          strokeWidth="1.5"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
          />
        </svg>
      )
    }

    if (link.type === 'phone') {
      return (
        <svg
          className="h-5 w-5"
          fill="none"
          strokeWidth="1.5"
          stroke="currentColor"
          viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
          />
        </svg>
      )
    }

    if (link.type === 'social') {
      try {
        const domain = new URL(link.url).hostname.replace('www.', '')
        const SocialIcon = SOCIAL_MEDIA_ICONS[domain]?.icon
        if (SocialIcon) {
          return (
            <SocialIcon className="h-5 w-5" style={{ color: SOCIAL_MEDIA_ICONS[domain].color }} />
          )
        }
      } catch {
        // Fall back to default link icon
      }
    }

    // Default link icon for simple links or fallback
    return (
      <svg
        className="h-5 w-5"
        fill="none"
        strokeWidth="1.5"
        stroke="currentColor"
        viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
        />
      </svg>
    )
  }

  const renderLinkItem = (link: ILinkItem) => {
    const href =
      link.type === 'email'
        ? `mailto:${link.url}`
        : link.type === 'phone'
          ? `tel:${link.url}`
          : link.url

    return (
      <div
        key={link.url}
        className="group mb-3 w-full rounded-lg p-3 transition-all hover:bg-opacity-30"
        style={{ backgroundColor: `${link.metadata.themeColor}20` }}>
        <a
          href={href}
          target={link.type === 'social' || link.type === 'simple' ? '_blank' : undefined}
          rel={link.type === 'social' || link.type === 'simple' ? 'noopener noreferrer' : undefined}
          className="flex items-center space-x-3 text-gray-700 hover:text-gray-900">
          <span className="flex-shrink-0">{getLinkIcon(link)}</span>
          <div className="flex-1 overflow-hidden">
            <span className="block truncate">{link.metadata.title || link.url}</span>
            {link.metadata.description && (
              <span className="mt-1 block truncate text-sm text-gray-500">
                {link.metadata.description}
              </span>
            )}
          </div>
        </a>
      </div>
    )
  }

  return (
    <UserModalContext.Provider value={{ openUserModal, closeUserModal }}>
      {children}
      <Modal id="avatar_modal" className="p-0" isOpen={isModalOpen} setIsOpen={setIsModalOpen}>
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loading />
          </div>
        ) : userData ? (
          <div className="flex max-h-[80vh] flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 !-mt-3 bg-white p-6 shadow-sm">
              <div className="flex items-center">
                <div className="flex flex-1 items-center space-x-4">
                  <Avatar
                    id={userData.id}
                    src={userData.avatar_url}
                    avatarUpdatedAt={userData.avatar_updated_at}
                    alt={userData.full_name}
                    size={64}
                    clickable={false}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                  <div>
                    <h2 className="text-xl font-bold">{userData.full_name}</h2>
                    <p className="text-gray-600">@{userData.username}</p>
                  </div>
                </div>
                <button className="btn btn-circle btn-xs" onClick={closeUserModal}>
                  <IoCloseSharp size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Bio Section */}
              {userData.profile_data?.bio && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">About</h3>
                  <p className="whitespace-pre-line text-gray-700">{userData.profile_data.bio}</p>
                </div>
              )}

              {/* Links Section */}
              {userData.profile_data?.linkTree && userData.profile_data.linkTree.length > 0 && (
                <div className="mt-5 space-y-3">
                  <h3 className="text-lg font-semibold">Contact Information</h3>
                  <div className="space-y-2">
                    {userData.profile_data.linkTree.map(renderLinkItem)}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </UserModalContext.Provider>
  )
}

export const useUserModal = () => {
  const context = useContext(UserModalContext)
  if (!context) {
    throw new Error('useUserModal must be used within a UserModalProvider')
  }
  return context
}
