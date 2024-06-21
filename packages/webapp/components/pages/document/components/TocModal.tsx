import React, { useCallback } from 'react'
import Link from 'next/link'
import DocTitle from '@components/TipTap/DocTitle'
import { DocsPlus } from '@icons'
import { useStore } from '@stores'
import { IoClose } from 'react-icons/io5'
import { MdFilterAlt } from 'react-icons/md'
import TableOfContents from '@components/TipTap/tableOfContents/mobile'

const TocModal = () => {
  const {
    editor: { loading, applyingFilters, rendering, instance: editor }
  } = useStore((state) => state.settings)

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

  if (loading || !editor || applyingFilters || rendering) {
    return null
  }

  return (
    <div className="z-30 h-dvh w-4/5 min-w-[80%] max-w-[80%] bg-base-200 text-base-content">
      <div className="modalWrapper relative sticky top-0 z-30 size-full overflow-hidden overflow-y-auto">
        <div className="sticky top-0 z-20 flex w-full justify-center overflow-hidden border-b bg-base-100 py-3 align-middle">
          <Link
            href="/"
            className="ml-1 flex size-8 justify-center align-middle text-black outline-0">
            <DocsPlus size={70} />
          </Link>
          <DocTitle className="mt-0 w-8/12 overflow-hidden" />
          <div className="ml-auto mr-3 flex w-4/12 flex-row items-center justify-end">
            <button onClick={openFilterModal} className="btn_openFilterModal btn btn-circle btn-xs">
              <MdFilterAlt size={18} />
            </button>
            <label
              htmlFor="mobile_left_side_panel"
              aria-label="close sidebar"
              className="btn btn-circle btn-xs ml-2">
              <IoClose size={20} />
            </label>
          </div>
        </div>
        <div className="h-full overflow-y-auto pb-16">
          <TableOfContents className="tiptap__toc size-full pb-4 pl-2" />
        </div>
      </div>
    </div>
  )
}

export default TocModal
