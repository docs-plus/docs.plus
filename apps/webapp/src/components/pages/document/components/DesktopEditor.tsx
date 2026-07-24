import { Chatroom } from '@components/chatroom'
import { HyperlinkPopoverPortal } from '@components/TipTap/hyperlinkPopovers/HyperlinkPopoverPortal'
import EditorToolbar from '@components/TipTap/toolbar/desktop/EditorToolbar'
import { useHeadingScrollSpy } from '@components/toc/hooks/useHeadingScrollSpy'
import ResizeHandle from '@components/ui/ResizeHandle'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { useRef } from 'react'

import { useAdjustEditorSizeForChatRoom, useTocResize } from '../hooks'
import EditorContent from './EditorContent'
import TOC from './Toc'

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const { tocRef, tocWidth, isResizing, handleMouseDown } = useTocResize()

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useUnreadSync()

  useHeadingScrollSpy(editorWrapperRef)

  return (
    <>
      {/* No entry animation: at S1 this still shows ToolbarSkeleton — identical pixels
          to the page skeleton's strip; fading it would blank and re-show the same bones. */}
      <div className="toolbars bg-base-100 border-base-300 fixed bottom-0 z-[9] h-auto w-full border-t sm:relative sm:block sm:border-t-0">
        <EditorToolbar />
      </div>

      <div className="editor relative flex size-full min-h-0 flex-row-reverse bg-[var(--pad-well)]">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={editorWrapperRef}
            className="editorWrapper scrollbar-custom scrollbar-thin flex h-full grow items-start justify-center overflow-y-auto scroll-smooth border-t-0 bg-[var(--pad-well)] px-3 py-4 sm:px-6 sm:py-6">
            <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
          </div>

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

            {/* v2 feed renders Virtuoso-backed ChatList internally. */}
            <Chatroom.MessageFeed showScrollToBottom={true} />
            <Chatroom.ChannelComposer className="w-full" />
          </Chatroom>
        </div>

        <div
          ref={tocRef}
          // z-[42]: TOC column paints above the sash hairline (z-41) so the row/grip overhang
          // isn't clipped; below floating overlays (Dialog/Popover z-50).
          className="tableOfContents relative z-[42] h-full max-h-full min-h-0 min-w-0 shrink-0 overflow-visible bg-[var(--pad-well)]"
          style={{ width: tocWidth }}>
          <TOC />
        </div>

        {/* Above docked chat (z-40) so the hairline isn't doubled; below TOC (z-42) and
            floating overlays (z-50) so presence + modals/popovers stay on top. */}
        <div className="absolute inset-y-0 z-[41] w-0" style={{ left: tocWidth }}>
          <ResizeHandle
            orientation="vertical"
            onMouseDown={handleMouseDown}
            isResizing={isResizing}
          />
        </div>
      </div>

      <HyperlinkPopoverPortal />
    </>
  )
}

export default DesktopEditor
