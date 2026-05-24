import { TocHeader, TocMobile } from '@components/toc'
import Button from '@components/ui/Button'
import { useModal } from '@components/ui/ModalDrawer'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useBottomSheet } from '@hooks/useBottomSheet'
import { DocsPlusIcon, Icons } from '@icons'
import { useAuthStore, useStore } from '@stores'
import Link from 'next/link'
import { useCallback } from 'react'
import type { IconType } from 'react-icons'

type TocModalIconButtonProps = {
  'aria-label': string
  onClick: () => void
  startIcon: IconType
}

function TocModalIconButton({
  'aria-label': ariaLabel,
  onClick,
  startIcon
}: TocModalIconButtonProps) {
  return (
    <Button
      aria-label={ariaLabel}
      variant="ghost"
      size="md"
      shape="square"
      iconSize={18}
      className="text-base-content/60 hover:text-base-content hover:bg-base-300 rounded-field focus-visible:ring-primary/30 focus-visible:ring-2 focus-visible:outline-none"
      onClick={onClick}
      startIcon={startIcon}
    />
  )
}

const TocModal = () => {
  const { close: closeModal } = useModal() || {}
  const user = useAuthStore((state) => state.profile)
  const { openFilters, openBookmarks, openDocumentSettings } = useBottomSheet()
  const loading = useStore((state) => state.settings.editor.loading)
  const applyingFilters = useStore((state) => state.settings.editor.applyingFilters)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

  const openSheetFromToc = useCallback(
    (open: () => void) => {
      closeModal?.()
      open()
    },
    [closeModal]
  )

  if (loading || !editor || applyingFilters || providerSyncing) {
    return null
  }

  return (
    <div className="bg-base-100 z-30 flex h-dvh max-h-dvh w-full max-w-[80%] min-w-[80%] flex-col overflow-hidden">
      <div className="modalWrapper z-30 flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="border-base-300 bg-base-100 z-20 flex shrink-0 items-center justify-between border-b px-4 py-3">
          <Link
            href="/"
            className="text-base-content hover:text-primary flex items-center gap-1.5 outline-0 transition-colors"
            aria-label="Go to home">
            <DocsPlusIcon size={36} />
            <span className="text-base-content mt-1.5 font-semibold">docs.plus</span>
          </Link>

          <div className="bg-base-200 rounded-box flex items-center gap-1.5 p-1">
            <TocModalIconButton
              aria-label="View history"
              onClick={() => {
                closeModal?.()
                window.location.hash = 'history'
              }}
              startIcon={Icons.history}
            />
            <TocModalIconButton
              aria-label="Close sidebar"
              onClick={() => closeModal?.()}
              startIcon={Icons.close}
            />
          </div>
        </header>

        <div className="bg-base-200 flex min-h-0 flex-1 flex-col overflow-hidden">
          <TocHeader variant="mobile" />
          <ScrollArea className="h-0 min-h-0 flex-1" scrollbarSize="thin" hideScrollbar>
            <TocMobile className="tiptap__toc w-full pb-6 !pl-2" />
          </ScrollArea>
        </div>

        <footer className="border-base-300 bg-base-100 shrink-0 border-t px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
          <div className="bg-base-200 rounded-box flex w-full items-center justify-evenly gap-1 p-0">
            <TocModalIconButton
              aria-label="Open filters"
              onClick={() => openSheetFromToc(openFilters)}
              startIcon={Icons.filter}
            />
            <TocModalIconButton
              aria-label="Document settings"
              onClick={() => openSheetFromToc(openDocumentSettings)}
              startIcon={Icons.settings}
            />
            {user && (
              <TocModalIconButton
                aria-label="Bookmarks"
                onClick={() => openSheetFromToc(openBookmarks)}
                startIcon={Icons.bookmark}
              />
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default TocModal
