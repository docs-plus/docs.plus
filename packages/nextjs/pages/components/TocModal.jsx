import React from 'react'
import Link from 'next/link'

import { useEditorStateContext } from '../../context/EditorContext'
import DocTitle from '../../components/TipTap/DocTitle'
import { Filter, DocsPlus } from '../../components/icons/Icons'
import TOC from './Toc'

const TocModal = ({ editor, docId, docTitle }) => {
  const { loading, applyingFilters } = useEditorStateContext()

  const closeLeftSideModal = () => {
    const leftSideModal = document.querySelector('.nd_modal.left')
    const modalWrapper = leftSideModal.querySelector('.modalWrapper')
    const modalBg = leftSideModal.querySelector('.modalBg')

    modalWrapper.classList.remove('active')
    modalBg.classList.remove('active')

    editor?.setEditable(false)

    modalBg.ontransitionend = () => {
      leftSideModal.classList.add('hidden')
    }
  }

  const openFilterModal = () => {
    const bottomSideModal = document.querySelector('.nd_modal.bottom')
    const modalWrapper = bottomSideModal.querySelector('.modalWrapper')
    const modalBg = bottomSideModal.querySelector('.modalBg')

    bottomSideModal.classList.remove('hidden')
    modalBg.classList.add('active')

    setTimeout(() => {
      modalWrapper.classList.add('active')
    }, 200)
  }

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
            <DocsPlus size="70" />
          </Link>
          <DocTitle
            docId={docId}
            docTitle={docTitle}
            className="w-8/12 overflow-hidden mt-0"
          />
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
