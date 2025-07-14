import React, { useCallback } from 'react'
import Link from 'next/link'
import DocTitle from '@components/TipTap/DocTitle'
import { DocsPlus } from '@icons'
import { useStore } from '@stores'
import { IoClose } from 'react-icons/io5'
import { MdFilterAlt, MdHistory } from 'react-icons/md'
import TableOfContents from '@components/TipTap/tableOfContents/mobile/TocMobile'
import { useModal } from '@components/ui/ModalDrawer'

const TocModal = ({ setIsFilterModalOpen }: any) => {
  const { close: closeModal } = useModal() || {}
  const {
    editor: { loading, applyingFilters, providerSyncing, instance: editor }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || providerSyncing) {
    return null
  }

  return (
    <div className="bg-base-200 text-base-content z-30 h-full w-full max-w-[80%] min-w-[80%]">
      <div className="modalWrapper z-30 size-full overflow-hidden overflow-y-auto">
        <div className="bg-base-100 sticky top-0 z-20 flex w-full justify-center overflow-hidden border-b border-gray-300 py-3 align-middle">
          <Link
            href="/"
            className="ml-1 flex size-8 justify-center align-middle text-black outline-0">
            <DocsPlus size={70} />
          </Link>
          <DocTitle className="mt-0 w-8/12 overflow-hidden" />
          <div className="join mr-3 ml-auto flex w-4/12 flex-row items-center justify-end">
            <label
              htmlFor="mobile_history_panel"
              aria-label="close sidebar"
              className="btn btn-sm join-item"
              onClick={() => {
                closeModal?.()
                window.location.hash = 'history'
              }}>
              <MdHistory size={20} />
            </label>
            <label
              htmlFor="mobile_history_panel"
              onClick={() => {
                setIsFilterModalOpen(true)
                closeModal?.()
              }}
              className="btn btn-sm join-item">
              <MdFilterAlt size={18} />
            </label>
            <label
              onClick={() => closeModal?.()}
              htmlFor="mobile_history_panel"
              aria-label="close sidebar"
              className="btn btn-sm join-item">
              <IoClose size={22} />
            </label>
          </div>
        </div>
        <div className="h-full">
          <TableOfContents className="tiptap__toc size-full pb-4 pl-2" />
        </div>
      </div>
    </div>
  )
}

export default TocModal
