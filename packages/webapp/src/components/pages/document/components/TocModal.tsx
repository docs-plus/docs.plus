import AppendHeadingButton from '@components/pages/document/components/AppendHeadingButton'
import { TocHeader, TocMobile } from '@components/toc'
import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import { ScrollArea } from '@components/ui/ScrollArea'
import { DocsPlusIcon } from '@icons'
import { Icons } from '@icons'
import { useSheetStore, useStore } from '@stores'
import Link from 'next/link'
import React from 'react'

interface TocModalProps {
  filterModalRef?: React.RefObject<unknown>
}

const TocModal = ({ filterModalRef: _filterModalRef }: TocModalProps) => {
  const { close: closeModal } = useModal() || {}
  const { openSheet } = useSheetStore()
  const loading = useStore((state) => state.settings.editor.loading)
  const applyingFilters = useStore((state) => state.settings.editor.applyingFilters)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

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
            <DocsPlusIcon size={36} />
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
              startIcon={Icons.history}
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
              startIcon={Icons.filter}
            />
            <Button
              aria-label="Close sidebar"
              variant="ghost"
              size="md"
              shape="square"
              iconSize={18}
              className="text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-field focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => closeModal?.()}
              startIcon={Icons.close}
            />
          </div>
        </header>

        {/* Content — doc title outside scroll so list viewport matches scrollIntoView */}
        <div className="bg-base-200 flex min-h-0 flex-1 flex-col overflow-hidden">
          <TocHeader variant="mobile" />
          <ScrollArea className="min-h-0 flex-1" scrollbarSize="thin" hideScrollbar>
            <TocMobile className="tiptap__toc w-full pb-4 !pl-2" hideAppendButton />
          </ScrollArea>
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
