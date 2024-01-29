import Link from 'next/link'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { DocsPlus, Hamburger, Check } from '@icons'
import DocTitle from '../DocTitle'
import PresentUsers from './PresentUsers'
import ReadOnlyIndicator from './ReadOnlyIndicator'
import FilterBar from './FilterBar'
import ProfileSection from './ProfileSection'
import ShareModalSection from './ShareSection'
import { useStore } from '@stores'

const PadTitle = () => {
  const isKeyboardOpen = useDetectKeyboardOpen()
  const { isAuthServiceAvailable } = useStore((state) => state.settings)

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
        <DocTitle />
        <FilterBar />
      </div>

      <ReadOnlyIndicator />

      <div className="ml-auto flex align-middle ">
        {isAuthServiceAvailable && <PresentUsers className="sm:block hidden" />}
        <ShareModalSection />
        {isAuthServiceAvailable && <ProfileSection />}
      </div>
    </div>
  )
}

export default PadTitle
