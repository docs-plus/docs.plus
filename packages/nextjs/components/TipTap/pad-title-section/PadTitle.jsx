import Link from 'next/link'
import DocTitle from '../DocTitle'
import { DocsPlus, Hamburger, Check } from '@icons'
import { useEditorStateContext } from '@context/EditorContext'
import { useUser } from '@supabase/auth-helpers-react'
import { Avatar } from '@components/Avatar'
import PubSub from 'pubsub-js'
import Button from '@components/Button'

import useDetectKeyboardOpen from 'use-detect-keyboard-open'

const PadTitle = ({ docTitle, docId, editor }) => {
  const isKeyboardOpen = useDetectKeyboardOpen()
  const user = useUser()
  const { isAuthServiceAvailable } = useEditorStateContext()

  const btn_leftOpenModal = (e) => {
    if (!e.target.closest('button').classList.contains('btn_modal')) return

    const leftModal = document.querySelector('.nd_modal.left')
    leftModal.classList.remove('hidden')

    const modalBg = leftModal.querySelector('.modalBg')
    modalBg.classList.add('active')

    // editor?.setEditable(true)
    // find div.ProseMirror and add attribute contenteditable=true
    const divProseMirror = document.querySelector('.ProseMirror')
    divProseMirror.setAttribute('contenteditable', 'true')

    setTimeout(() => {
      leftModal.querySelector('.modalWrapper').classList.add('active')
    }, 200)
  }

  const btn_blurEditor = () => {}

  const openControlCenter = () => {
    PubSub.publish('toggleControlCenter', true)
  }

  const ProfileSection = ({ user }) => {
    return (
      <div className="ml-auto mr-2 flex">
        {user && (
          <button onClick={openControlCenter}>
            <Avatar width={24} height={24} className="rounded-full shadow-md border w-11 h-11" />
          </button>
        )}
        {!user && <Button onClick={openControlCenter}>Signin</Button>}
      </div>
    )
  }

  return (
    <div className="flex flex-row items-center w-full justify-center sm:justify-normal">
      <div className="padLog hidden sm:block">
        <Link href="/">
          <DocsPlus size="34" />
        </Link>
      </div>
      {/* <div className="sm:hidden">
        {isKeyboardOpen ? (
          <button onTouchStart={btn_blurEditor} className="w-10 h-10 flex align-middle justify-center items-center">
            <Check size="30" />
          </button>
        ) : (
          <button
            onTouchStart={btn_leftOpenModal}
            className="btn_modal w-10 h-10 flex align-middle justify-center items-center"
            type="button">
            <Hamburger size="30" />
          </button>
        )}
      </div> */}
      <DocTitle docId={docId} docTitle={docTitle} />
      <ProfileSection user={user} />
      <div className="w-10 h-10 border rounded-full bg-gray-400 ml-auto sm:hidden"></div>
    </div>
  )
}

export default PadTitle