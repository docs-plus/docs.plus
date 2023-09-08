import Link from 'next/link'
import DocTitle from '../DocTitle'
import { DocsPlus, Hamburger, Check, PrivateShare } from '@icons'
import { useUser } from '@supabase/auth-helpers-react'
import Button from '@components/ui/Button'
import ShareModal from './ShareModal'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import PresentUsers from './PresentUsers'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import { useEditorStateContext } from '@context/EditorContext'
import FilterBar from './FilterBar'
import { Dialog, DialogTrigger, DialogContent } from '@components/ui/Dialog'
import ProfileSection from './ProfileSection'

const PadTitle = ({ docMetadata }) => {
  const isKeyboardOpen = useDetectKeyboardOpen()
  const user = useUser()
  const { isAuthServiceAvailable } = useEditorStateContext()

  const btn_leftOpenModal = (e) => {
    if (!e.target.closest('button').classList.contains('btn_modal')) return

    const leftModal = document.querySelector('.nd_modal.left')
    leftModal.classList.remove('hidden')

    const modalBg = leftModal.querySelector('.modalBg')
    modalBg.classList.add('active')

    // find div.ProseMirror and add attribute contenteditable=true
    const divProseMirror = document.querySelector('.ProseMirror')
    divProseMirror.setAttribute('contenteditable', 'true')

    setTimeout(() => {
      leftModal.querySelector('.modalWrapper').classList.add('active')
    }, 200)
  }

  const btn_blurEditor = () => {}

  const ShareModalSection = () => {
    return (
      <Dialog>
        <DialogTrigger asChild={true}>
          <Button
            Icon={PrivateShare}
            className="hover:bg-indigo-500 transition-all bg-docsy hidden sm:flex mt-0 drop-shadow-sm font-light ml-6 text-white w-28">
            Share
          </Button>
        </DialogTrigger>
        <DialogContent>
          <ShareModal docMetadata={docMetadata} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="flex flex-row items-center align-middle w-full justify-center sm:justify-normal">
      <div className="padLog hidden sm:block">
        <Link href="/">
          <DocsPlus size="34" />
        </Link>
      </div>
      <div className="sm:hidden">
        {isKeyboardOpen ? (
          <button
            onTouchStart={btn_blurEditor}
            className="w-10 h-10 flex align-middle justify-center items-center">
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
      </div>

      <div className="flex align-middle items-center justify-start">
        <DocTitle docMetadata={docMetadata} />
        <FilterBar />
      </div>

      <ReadOnlyIndicator docMetadata={docMetadata} />

      <div className="ml-auto flex align-middle ">
        {isAuthServiceAvailable && <PresentUsers user={user} className="sm:block hidden" />}
        <ShareModalSection />
        {isAuthServiceAvailable && <ProfileSection user={user} />}
      </div>
    </div>
  )
}

export default PadTitle
