import { Chatroom } from '@components/chatroom'
import FindBar from '@components/TipTap/find/FindBar'
import { HyperlinkPopoverPortal } from '@components/TipTap/hyperlinkPopovers/HyperlinkPopoverPortal'
import EditorToolbar from '@components/TipTap/toolbar/desktop/EditorToolbar'
import { useHeadingScrollSpy } from '@components/toc/hooks/useHeadingScrollSpy'
import { TocTickRail } from '@components/toc/TocTickRail'
import ResizeHandle from '@components/ui/ResizeHandle'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { useStore } from '@stores'
import { twMerge } from '@utils/twMerge'
import { memo, type RefObject, useMemo, useRef, useState } from 'react'

import { useSyncChatPanelHeight, useTocResize } from '../hooks'
import EditorContent from './EditorContent'
import { PadQrCode } from './PadQrCode'
import { PAD_MAIN_ID } from './SkipToPadMain'
import TOC from './Toc'

const DesktopPadEditor = memo(function DesktopPadEditor({
  wrapperRef
}: {
  wrapperRef: RefObject<HTMLDivElement | null>
}) {
  useSyncChatPanelHeight(wrapperRef)
  return (
    <main
      ref={wrapperRef}
      id={PAD_MAIN_ID}
      tabIndex={-1}
      className="editorWrapper scrollbar-custom flex h-full min-w-0 grow scrollbar-thin flex-col items-center overflow-y-auto scroll-smooth border-t-0 bg-[var(--pad-well)] px-3 py-4 outline-none sm:px-6 sm:py-6">
      <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
    </main>
  )
})

const DesktopPadToc = memo(TOC)

const DesktopPadChat = memo(function DesktopPadChat() {
  return (
    <Chatroom variant="desktop">
      <Chatroom.Toolbar>
        <Chatroom.Toolbar.Breadcrumb />
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <Chatroom.Toolbar.ParticipantsList />
          <div className="bg-base-200 rounded-field flex items-center">
            <Chatroom.Toolbar.ShareButton />
            <Chatroom.Toolbar.NotificationToggle />
            <Chatroom.Toolbar.CloseButton />
          </div>
        </div>
      </Chatroom.Toolbar>

      <Chatroom.MessageFeed showScrollToBottom />
      <Chatroom.ChannelComposer className="w-full" />
    </Chatroom>
  )
})

// Mod-f stays with the browser until the first sync.
const DesktopPadFind = memo(function DesktopPadFind() {
  const editor = useStore((state) => state.settings.editor.instance)
  const ready = useStore(
    (state) => !state.settings.editor.loading && !state.settings.editor.providerSyncing
  )
  return editor && ready ? <FindBar editor={editor} variant="desktop" /> : null
})

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)
  const documentId = useStore((state) => state.settings.metadata?.documentId)
  const isPrivate = useStore((state) => Boolean(state.settings.metadata?.isPrivate))
  // Session-only, like the tick rail. A pad switch keeps this layout mounted, so the
  // shown state names its pad and a switch reads it as hidden. A Private pad shows no QR.
  const [qrDocumentId, setQrDocumentId] = useState<string | null>(null)
  const isQrShown = !isPrivate && documentId != null && qrDocumentId === documentId
  // On a Private pad the toggle greys out, like any tool that does not apply.
  const qr = useMemo(
    () => ({
      shown: isQrShown,
      disabled: isPrivate,
      onToggle: () => setQrDocumentId(isQrShown ? null : (documentId ?? null))
    }),
    [documentId, isPrivate, isQrShown]
  )

  const {
    tocRef,
    paintedWidth,
    isResizing,
    isRail,
    isSettlingToRail,
    isContentHidden,
    handleMouseDown,
    openWide
  } = useTocResize()

  const tocHeightClass =
    isRail || isSettlingToRail ? 'h-[calc(100%-var(--chat-panel-height,0px))]' : 'h-full'

  useUnreadSync()

  useHeadingScrollSpy(editorWrapperRef)

  const tocColumn = (
    <div
      ref={tocRef}
      className={twMerge(
        'tableOfContents relative z-[42] max-h-full min-h-0 min-w-0 shrink-0 bg-[var(--pad-well)]',
        tocHeightClass,
        !isResizing &&
          'motion-safe:transition-[width,height] motion-safe:duration-[var(--motion-overlay-in)] motion-safe:ease-out'
      )}
      style={{
        width: paintedWidth,
        overflow: isContentHidden ? 'hidden' : undefined
      }}>
      <div
        className={twMerge(
          'h-full min-h-0',
          !isResizing &&
            'motion-safe:transition-opacity motion-safe:duration-[var(--motion-overlay-in)] motion-safe:ease-out',
          isContentHidden ? 'pointer-events-none w-0 overflow-hidden opacity-0' : 'opacity-100'
        )}>
        <DesktopPadToc />
      </div>
    </div>
  )

  return (
    <>
      {/* No entry animation: at S1 this still shows ToolbarSkeleton — identical pixels
          to the page skeleton's strip; fading it would blank and re-show the same bones. */}
      <div className="toolbars bg-base-100 border-base-300 fixed bottom-0 z-[9] h-auto w-full border-t sm:relative sm:block sm:border-t-0">
        <EditorToolbar qr={qr} />
      </div>

      <div className="editor relative flex size-full min-h-0 flex-row-reverse bg-[var(--pad-well)]">
        <div className="group/padcol relative flex min-h-0 min-w-0 flex-1 flex-col">
          <DesktopPadFind />
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-row-reverse">
            <DesktopPadEditor wrapperRef={editorWrapperRef} />
            {isRail && (
              <div
                className="tableOfContents relative z-[42] h-[calc(100%-var(--chat-panel-height,0px))] max-h-full min-h-0 min-w-0 shrink-0 bg-[var(--pad-well)]"
                style={{ width: paintedWidth }}>
                <TocTickRail onOpenWide={openWide} />
              </div>
            )}
            {isQrShown && <PadQrCode />}
          </div>

          <DesktopPadChat />
        </div>

        {!isRail && (
          <>
            {tocColumn}
            <div
              className={twMerge(
                'absolute top-0 bottom-[var(--chat-panel-height,0px)] z-[41] w-0',
                !isResizing &&
                  'motion-safe:transition-[left] motion-safe:duration-[var(--motion-overlay-in)] motion-safe:ease-out'
              )}
              style={{ left: paintedWidth }}>
              <ResizeHandle
                orientation="vertical"
                onMouseDown={handleMouseDown}
                isResizing={isResizing}
              />
            </div>
          </>
        )}
      </div>

      <HyperlinkPopoverPortal />
    </>
  )
}

export default DesktopEditor
