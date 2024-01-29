import { create } from 'zustand'
import { ModalContainer } from './ui/ModalContainer'
import { Avatar } from './ui/Avatar'
import { useEffect, useRef } from 'react'
import { IoCloseOutline } from 'react-icons/io5'
import { FaRegUser } from 'react-icons/fa'
import { AiOutlineExclamationCircle } from 'react-icons/ai'

export const useUserProfileModalStore = create((set) => ({
  modalOpen: false,
  modalId: '',
  modalData: null,
  openModal: (id: string, data: any) => set({ modalOpen: true, modalId: id, modalData: data }),
  closeModal: () => set({ modalOpen: false, modalId: '', modalData: null })
}))

export const UserProfileModal = () => {
  const { modalOpen, modalData, closeModal }: any = useUserProfileModalStore()
  const triggerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    // check the checkbox
    triggerRef.current?.click()
  }, [modalOpen])

  const handleCheckboxChange = () => {
    // Here you can handle the change in checkbox state
    const isChecked = triggerRef.current?.checked
    if (!isChecked) closeModal()

    // closeModal()
  }

  if (!modalOpen) {
    return null
  }

  const userName = modalData.full_name || modalData.username || modalData.email || 'Unknown'
  const userAvatarUrl = modalData?.avatar_url

  return (
    <>
      <ModalContainer
        id="display_user_card"
        triggerRef={triggerRef}
        onCheckboxChange={handleCheckboxChange}>
        <div className="mb-4 flex justify-center">
          <div>
            <span>
              <b>User Info</b>
            </span>
          </div>
          <div className="ml-auto">
            <button className="btn btn-circle  btn-sm" onClick={closeModal}>
              <IoCloseOutline className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="flex items-center">
          <div className="mr-6">
            <Avatar
              displayPresence={true}
              src={userAvatarUrl}
              online={modalData.status}
              alt={`avatar_${modalData.id}`}
              id={modalData.id}
              size={96}
              className="m-0 rounded-full ring ring-primary ring-offset-2 ring-offset-base-100"
            />
          </div>
          <div>
            <div>{userName}</div>
            <small>last seen recently</small>
          </div>
        </div>
        <div className="divider"></div>
        <div className="mb-4 ">
          <span className="mb-8">
            <b>Account Info</b>
          </span>
          <div className="mt-4 flex items-center justify-start">
            <div className="p-4">
              <FaRegUser />
            </div>
            <div className="ml-4">
              <div>@{modalData.username}</div>
              <div className="text-xs font-bold">Username</div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-start">
            <div className="p-4">
              <AiOutlineExclamationCircle />
            </div>
            <div className="ml-4">
              <div>{modalData.description || '---'}</div>
              <div className="text-xs font-bold">Bio</div>
            </div>
          </div>
        </div>
        <div className="divider"></div>
        <div>
          <button className="btn btn-block">Send Message</button>
        </div>
      </ModalContainer>
    </>
  )
}
