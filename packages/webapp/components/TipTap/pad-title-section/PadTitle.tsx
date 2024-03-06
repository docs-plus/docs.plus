import Link from 'next/link'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { DocsPlus, Hamburger, Check } from '@icons'
import DocTitle from '../DocTitle'
import PresentUsers from './PresentUsers'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import FilterBar from './FilterBar'
import { useStore } from '@stores'
import Modal from '@components/ui/Modal'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import ShareModal from './ShareModal'
import { PrivateShare } from '@icons'
import Loading from '@components/ui/Loading'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <Loading />
})

const PadTitle = () => {
  const user = useAuthStore((state) => state.profile)
  const isKeyboardOpen = useDetectKeyboardOpen()
  const { isAuthServiceAvailable } = useStore((state) => state.settings)
  const [isProfileModalOpen, setProfileModalOpen] = useState(false)
  const [isShareModalOpen, setShareModalOpen] = useState(false)

  const btn_leftOpenModal = (e: any) => {
    if (!e.target.closest('button').classList.contains('btn_modal')) return

    const leftModal = document.querySelector('.nd_modal.left') as HTMLDivElement
    leftModal.classList.remove('hidden')

    const modalBg = leftModal.querySelector('.modalBg') as HTMLDivElement
    modalBg.classList.add('active')

    // find div.ProseMirror and add attribute contenteditable=true
    const divProseMirror = document.querySelector('.ProseMirror') as HTMLDivElement
    divProseMirror.setAttribute('contenteditable', 'true')

    setTimeout(() => {
      leftModal.querySelector('.modalWrapper')?.classList.add('active')
    }, 200)
  }

  const btn_blurEditor = () => {}

  return (
    <>
      <div className="docTitle bg-white z-10 relative w-full min-h-12 p-2 flex flex-row items-center sm:border-b-0 border-b">
        <div className="flex flex-row items-center align-middle w-full justify-center sm:justify-normal">
          <div className="padLog hidden sm:block">
            <Link href="/">
              <DocsPlus size={34} />
            </Link>
          </div>
          <div className="sm:hidden">
            {isKeyboardOpen ? (
              <button
                onTouchStart={btn_blurEditor}
                className="w-10 h-10 flex align-middle justify-center items-center">
                <Check size={30} />
              </button>
            ) : (
              <button
                onTouchStart={btn_leftOpenModal}
                className="btn_modal w-10 h-10 flex align-middle justify-center items-center"
                type="button">
                <Hamburger size={30} />
              </button>
            )}
          </div>

          <div className="flex align-middle items-center justify-start">
            <DocTitle />
            <FilterBar />
          </div>

          <ReadOnlyIndicator />

          <div className="ml-auto flex items-center justify-center">
            {isAuthServiceAvailable && <PresentUsers />}
            <Button
              className="btn-wide ml-3 h-[2.6rem] min-h-[2.6rem] max-w-28 btn-primary text-white"
              onClick={() => setShareModalOpen(true)}>
              <PrivateShare />
              Share
            </Button>
            {isAuthServiceAvailable && (
              <div className="mr-2 ml-5 sm:flex hidden">
                {user ? (
                  <Button
                    className="btn-ghost tooltip tooltip-bottom btn-circle"
                    onClick={() => setProfileModalOpen(true)}
                    data-tip="Profile">
                    <Avatar
                      id={user.id}
                      src={user.avatar_url}
                      width={24}
                      height={24}
                      className="rounded-full shadow-xl border w-11 h-11 cursor-pointer"
                    />
                  </Button>
                ) : (
                  <Button
                    id="btn_signin"
                    className="btn btn-neutral h-[2.6rem] min-h-[2.6rem]"
                    onClick={() => setProfileModalOpen(true)}>
                    Signin
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal id="modal_share" isOpen={isShareModalOpen} setIsOpen={setShareModalOpen}>
        <ShareModal setIsOpen={setShareModalOpen} />
      </Modal>

      <Modal
        asAChild={false}
        id="modal_profile"
        isOpen={isProfileModalOpen}
        setIsOpen={setProfileModalOpen}>
        <ControlCenter defaultTab="profile" />
      </Modal>
    </>
  )
}

export default PadTitle
