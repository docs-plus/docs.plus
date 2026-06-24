import { Chatroom } from '@components/chatroom'
import { HyperlinkPopoverPortal } from '@components/TipTap/hyperlinkPopovers/HyperlinkPopoverPortal'
import EditorToolbar from '@components/TipTap/toolbar/desktop/EditorToolbar'
import { useHeadingScrollSpy } from '@components/toc/hooks'
import ResizeHandle from '@components/ui/ResizeHandle'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { useRef } from 'react'

import { useAdjustEditorSizeForChatRoom, useTocResize } from '../hooks'
import EditorContent from './EditorContent'
import TOC from './Toc'

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const { tocRef, tocWidth, isResizing, handleMouseDown, editorContainerStyle } = useTocResize()

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

      <div className="editor bg-base-200 relative flex size-full flex-row-reverse justify-around align-top">
        <div className="relative flex flex-col align-top" style={editorContainerStyle}>
          <div
            ref={editorWrapperRef}
            className="editorWrapper scrollbar-custom scrollbar-thin bg-base-200 flex h-full grow items-start justify-center overflow-y-auto scroll-smooth border-t-0 px-3 py-4 sm:px-6 sm:py-6">
            <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
          </div>

          <Chatroom variant="desktop">
            <Chatroom.Toolbar>
              <Chatroom.Toolbar.Breadcrumb />
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <Chatroom.Toolbar.MediaFilterToggle />
                <Chatroom.Toolbar.ParticipantsList />
                <div className="bg-base-200 rounded-selector flex items-center">
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
          className="tableOfContents bg-base-200 relative isolate z-0 h-full max-h-full min-h-0 min-w-0"
          style={{ width: tocWidth }}>
          <ResizeHandle
            orientation="vertical"
            onMouseDown={handleMouseDown}
            isResizing={isResizing}
            className="z-[40]"
          />
          <TOC />
        </div>
      </div>

      <HyperlinkPopoverPortal />
    </>
  )
}

export default DesktopEditor
