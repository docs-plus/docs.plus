import { selectPadOwnsKeyboard } from '@components/chatroom/utils/selectPadOwnsKeyboard'
import { SheetFooter } from '@components/SheetFooter'
import { canOpenFind } from '@components/TipTap/find/canOpenFind'
import { indicatorDotClassName } from '@components/TipTap/toolbar/indicatorDot'
import { TocHeader, TocMobile } from '@components/toc'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import { useModal } from '@components/ui/ModalDrawer'
import { ScrollArea } from '@components/ui/ScrollArea'
import { DocsPlusIcon, Icons } from '@icons'
import {
  selectInProgressBookmarkCount,
  useAuthStore,
  useChatStore,
  useSheetStore,
  useStore,
  withInProgressBookmarks
} from '@stores'
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
      size="sm"
      shape="square"
      iconSize={20}
      className="text-base-content/70 hover:text-base-content hover:bg-base-300 rounded-field focus-visible:ring-primary focus-visible:ring-2 focus-visible:outline-none"
      onClick={onClick}
      startIcon={startIcon}
    />
  )
}

const TocModal = () => {
  const { close: closeModal } = useModal() || {}
  const user = useAuthStore((state) => state.profile)
  const openSheet = useSheetStore((state) => state.openSheet)
  const loading = useStore((state) => state.settings.editor.loading)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)
  // The drawer mounts only in MobileLayout, so this is always the phone rule.
  const findAllowed = canOpenFind(true, useChatStore(selectPadOwnsKeyboard))
  const inProgressBookmarks = useChatStore(selectInProgressBookmarkCount)

  const hasActiveFilters = useStore(
    (state) => state.settings.editor.filterResult.sortedSlugs.length > 0
  )

  const closeTocThen = useCallback(
    (next: () => void) => {
      closeModal?.()
      next()
    },
    [closeModal]
  )

  if (loading || !editor || providerSyncing) {
    return null
  }

  return (
    <div className="bg-base-100 z-30 flex h-dvh max-h-dvh w-full max-w-[80%] min-w-[80%] flex-col overflow-hidden">
      <div className="modalWrapper z-30 flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="border-base-300 bg-base-100 z-20 flex shrink-0 items-center justify-between border-b px-4 py-3">
          <Link
            href="/"
            className="text-base-content hover:text-primary rounded-field focus-visible:ring-primary flex items-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label="Go to home">
            <DocsPlusIcon size={36} />
            <span className="text-base-content mt-1.5 font-bold">docs.plus</span>
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
            <CloseButton
              aria-label="Close sidebar"
              onClick={() => closeModal?.()}
              size="sm"
              iconSize={20}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--pad-well)]">
          <TocHeader variant="mobile" />
          <ScrollArea className="h-0 min-h-0 flex-1" scrollbarSize="thin" hideScrollbar fade="both">
            <TocMobile className="tiptap__toc w-full pb-6" />
          </ScrollArea>
        </div>

        <SheetFooter>
          <div className="bg-base-200 rounded-box flex w-full items-center justify-evenly gap-1 p-0">
            {findAllowed && (
              <TocModalIconButton
                aria-label="Find in document"
                onClick={() => closeTocThen(() => editor.commands.openCaretFind())}
                startIcon={Icons.search}
              />
            )}
            <div className="relative">
              <TocModalIconButton
                aria-label={hasActiveFilters ? 'Open filters (active)' : 'Open filters'}
                onClick={() => closeTocThen(() => openSheet('filters'))}
                startIcon={Icons.filter}
              />
              {hasActiveFilters && (
                <span
                  data-testid="filter-active-indicator-mobile"
                  className={indicatorDotClassName('ring-base-200')}
                  aria-hidden
                />
              )}
            </div>
            <TocModalIconButton
              aria-label="Document settings"
              onClick={() => closeTocThen(() => openSheet('documentSettings'))}
              startIcon={Icons.settings}
            />
            {user && (
              <div className="relative">
                <TocModalIconButton
                  aria-label={withInProgressBookmarks('Bookmarks', inProgressBookmarks)}
                  onClick={() => closeTocThen(() => openSheet('bookmarks'))}
                  startIcon={Icons.bookmark}
                />
                {inProgressBookmarks > 0 && (
                  <span
                    data-testid="bookmarks-in-progress-indicator-mobile"
                    className={indicatorDotClassName('ring-base-200')}
                    aria-hidden
                  />
                )}
              </div>
            )}
          </div>
        </SheetFooter>
      </div>
    </div>
  )
}

export default TocModal
