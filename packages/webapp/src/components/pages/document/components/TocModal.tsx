import React from 'react'
import Link from 'next/link'
import DocTitle from '@components/TipTap/DocTitle'
import { DocsPlus } from '@icons'
import { useStore, useSheetStore } from '@stores'
import { MdFilterAlt, MdHistory } from 'react-icons/md'
import { TocMobile } from '@components/toc'
import { useModal } from '@components/ui/ModalDrawer'
import CloseButton from '@components/ui/CloseButton'
import Button from '@components/ui/Button'

interface TocModalProps {
  filterModalRef?: React.RefObject<unknown>
}

const TocModal = ({ filterModalRef: _filterModalRef }: TocModalProps) => {
  const { close: closeModal } = useModal() || {}
  const { openSheet } = useSheetStore()
  const {
    editor: { loading, applyingFilters, providerSyncing, instance: editor }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || providerSyncing) {
    return null
  }

  return (
    <div className="z-30 h-full w-full max-w-[80%] min-w-[80%] bg-white">
      <div className="modalWrapper z-30 flex size-full flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-3">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hover:text-primary flex size-8 items-center justify-center text-slate-800 outline-0 transition-colors">
              <DocsPlus size={70} />
            </Link>
            <DocTitle className="mt-0 max-w-[50vw] overflow-hidden" />
          </div>

          <div className="flex items-center gap-1">
            <Button
              aria-label="View history"
              variant="ghost"
              size="sm"
              shape="circle"
              className="text-base-content/60 hover:text-base-content"
              onClick={() => {
                closeModal?.()
                window.location.hash = 'history'
              }}
              startIcon={MdHistory}
            />
            <Button
              aria-label="Open filters"
              variant="ghost"
              size="sm"
              shape="circle"
              className="text-base-content/60 hover:text-base-content"
              onClick={() => {
                openSheet('filters')
                closeModal?.()
              }}
              startIcon={MdFilterAlt}
            />
            <CloseButton onClick={() => closeModal?.()} aria-label="Close sidebar" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <TocMobile className="tiptap__toc size-full pb-4 pl-2" />
        </div>
      </div>
    </div>
  )
}

export default TocModal
