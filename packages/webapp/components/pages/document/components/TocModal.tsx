import React, { useCallback } from 'react'
import Link from 'next/link'
import DocTitle from '@components/TipTap/DocTitle'
import { Filter, DocsPlus } from '@icons'
import TOC from './Toc'
import { useStore } from '@stores'

const TocModal = () => {
  const {
    editor: { instance: editor }
  } = useStore((state) => state.settings)

  // TODO: refactor needed
  const closeLeftSideModal = useCallback(() => {
    const leftSideModal = document.querySelector('.nd_modal.left') as HTMLDivElement
    const modalWrapper = leftSideModal.querySelector('.modalWrapper') as HTMLDivElement
    const modalBg = leftSideModal.querySelector('.modalBg') as HTMLDivElement

    modalWrapper.classList.remove('active')
    modalBg.classList.remove('active')

    // editor?.setEditable(false)
    const divProseMirror = document.querySelector('.ProseMirror') as HTMLDivElement
    divProseMirror.setAttribute('contenteditable', 'false')

    modalBg.ontransitionend = () => {
      leftSideModal.classList.add('hidden')
    }
  }, [])

  // TODO: refactor needed
  const openFilterModal = useCallback(() => {
    const bottomSideModal = document.querySelector('.nd_modal.bottom') as HTMLDivElement
    const modalWrapper = bottomSideModal.querySelector('.modalWrapper') as HTMLDivElement
    const modalBg = bottomSideModal.querySelector('.modalBg') as HTMLDivElement

    bottomSideModal.classList.remove('hidden')
    modalBg.classList.add('active')

    setTimeout(() => {
      modalWrapper.classList.add('active')
    }, 200)
  }, [])

  return (
    <div className="h-full">
      <div
        onTouchStart={closeLeftSideModal}
        onClick={closeLeftSideModal}
        className="modalBg absolute left-0 top-0 z-0 size-full bg-black opacity-40"></div>
      <div className="modalWrapper relative z-10 h-full w-10/12 overflow-hidden bg-white ">
        <div className="fixed top-0 flex w-full justify-center border-b bg-white py-3 align-middle text-blue-600 ">
          <Link
            href="/"
            className="ml-1 flex size-8 justify-center align-middle text-black outline-0">
            <DocsPlus size={70} />
          </Link>
          <DocTitle className="mt-0 w-8/12 overflow-hidden " />
          <div className="ml-auto mr-3 flex w-4/12 flex-row items-center justify-end">
            <button onClick={openFilterModal} className="btn_openFilterModal ml-1 size-6 outline-0">
              <Filter fill="rgba(0,0,0,.7)" />
            </button>
            <button
              onTouchStart={closeLeftSideModal}
              onClick={closeLeftSideModal}
              className="ml-2 size-6 rounded-full bg-slate-200 text-black outline-0">
              X
            </button>
          </div>
        </div>
        <div className="mt-16 h-full overflow-hidden pb-16 hover:overflow-auto">
          <TOC editor={editor} />
        </div>
      </div>
    </div>
  )
}

export default TocModal
