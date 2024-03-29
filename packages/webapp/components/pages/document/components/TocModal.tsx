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
        className="modalBg h-full w-full bg-black opacity-40 absolute top-0 left-0 z-0"></div>
      <div className="modalWrapper relative h-full z-10 bg-white w-10/12 overflow-hidden ">
        <div className="text-blue-600 py-3 flex fixed top-0 w-full border-b bg-white align-middle justify-center ">
          <Link
            href="/"
            className="w-8 h-8 flex align-middle justify-center text-black ml-1 outline-0">
            <DocsPlus size={70} />
          </Link>
          <DocTitle className="w-8/12 overflow-hidden mt-0 " />
          <div className="w-4/12 flex justify-end items-center flex-row ml-auto mr-3">
            <button
              onClick={openFilterModal}
              className="btn_openFilterModal w-6 h-6 ml-1 outline-0">
              <Filter fill="rgba(0,0,0,.7)" />
            </button>
            <button
              onTouchStart={closeLeftSideModal}
              onClick={closeLeftSideModal}
              className="w-6 h-6 ml-2 rounded-full bg-slate-200 text-black outline-0">
              X
            </button>
          </div>
        </div>
        <div className="h-full mt-16 pb-16 overflow-hidden hover:overflow-auto">
          <TOC editor={editor} />
        </div>
      </div>
    </div>
  )
}

export default TocModal
