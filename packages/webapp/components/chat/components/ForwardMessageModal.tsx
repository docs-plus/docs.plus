/* eslint-disable no-use-before-define */
// @ts-nocheck
import { ModalContainer } from './ui/ModalContainer'
import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { useStore, useAuthStore } from '@stores'
import { forwardMessage } from '@api'
import { useApi } from '@hooks/useApi'
import toast from 'react-hot-toast'

export const useForwardMessageModalStore = create((set) => ({
  modalOpen: false,
  modalId: '',
  modalData: null,
  openModal: (id: string, data: any) => set({ modalOpen: true, modalId: id, modalData: data }),
  closeModal: () => set({ modalOpen: false, modalId: '', modalData: null })
}))

const ForwardMessageModal = () => {
  const { modalOpen, modalData, closeModal }: any = useForwardMessageModalStore()
  const triggerRef = useRef<HTMLInputElement | null>(null)
  const channels = useStore((state) => state.channels)
  const user = useAuthStore((state) => state.profile)
  const { request } = useApi(forwardMessage, null, false)

  useEffect(() => {
    // check the checkbox
    triggerRef.current?.click()
  }, [modalOpen])

  const handleCheckboxChange = () => {
    // Here you can handle the change in checkbox state
    const isChecked = triggerRef.current?.checked
    if (!isChecked) closeModal()
  }

  const submitHandler = async (channel: any) => {
    await request(channel.id, user?.id, modalData?.id)
    closeModal()
    toast.success('Message forwarded successfully')
  }

  if (!modalOpen) return null

  return (
    <ModalContainer
      id="forward_message_modal"
      triggerRef={triggerRef}
      onCheckboxChange={handleCheckboxChange}>
      <div>
        <h2 className="mb-4 truncate text-2xl font-extrabold leading-none tracking-tight text-primary antialiased">
          Forward to ...
        </h2>
        <div className="mt-8 font-semibold">Channels:</div>
        <ul className="menu rounded-box bg-base-100 ">
          {[...channels.values()].map((channel) => (
            <li key={channel.id} onClick={() => submitHandler(channel)}>
              <a>{channel.name}</a>
            </li>
          ))}
        </ul>
        <div className="mt-12 flex w-full justify-between">
          <button className="btn btn-neutral w-1/6" onClick={closeModal}>
            Cancel
          </button>
        </div>
      </div>
    </ModalContainer>
  )
}

export default ForwardMessageModal
