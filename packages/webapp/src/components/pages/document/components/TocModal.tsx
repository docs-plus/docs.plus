import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { TocMobile } from '@components/toc'
import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import { DocsPlus } from '@icons'
import { useSheetStore, useStore } from '@stores'
import Link from 'next/link'
import React from 'react'
import { LuFilter, LuHistory, LuX } from 'react-icons/lu'

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
    <div className="bg-base-100 z-30 h-full w-full max-w-[80%] min-w-[80%]">
      <div className="modalWrapper z-30 flex size-full flex-col overflow-hidden">
        {/* Header — logo + action toolbar */}
        <header className="border-base-300 bg-base-100 sticky top-0 z-20 flex shrink-0 items-center justify-between border-b px-4 py-2">
          <Link
            href="/"
            className="text-base-content hover:text-primary flex items-center gap-1.5 outline-0 transition-colors"
            aria-label="Go to home">
            <DocsPlus size={36} />
            <span className="text-base-content mt-1.5 font-semibold">docs.plus</span>
          </Link>

          <div className="bg-base-200 rounded-box flex items-center gap-0.5 p-0.5">
            <Button
              aria-label="View history"
              variant="ghost"
              size="md"
              shape="square"
              iconSize={18}
              className="text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-field focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => {
                closeModal?.()
                window.location.hash = 'history'
              }}
              startIcon={LuHistory}
            />
            <Button
              aria-label="Open filters"
              variant="ghost"
              size="md"
              shape="square"
              iconSize={18}
              className="text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-field focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => {
                openSheet('filters')
                closeModal?.()
              }}
              startIcon={LuFilter}
            />
            <Button
              aria-label="Close sidebar"
              variant="ghost"
              size="md"
              shape="square"
              iconSize={18}
              className="text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-field focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => closeModal?.()}
              startIcon={LuX}
            />
          </div>
        </header>

        {/* Content — scrollable TOC list */}
        <div className="bg-base-200 flex-1 overflow-y-auto">
          <TocMobile className="tiptap__toc w-full pb-4 !pl-2" hideAppendButton />
        </div>

        {/* Sticky footer — add heading button */}
        <div className="border-base-300 bg-base-100 shrink-0 border-t">
          <AppendHeadingButton className="" />
        </div>
      </div>
    </div>
  )
}

export default TocModal
