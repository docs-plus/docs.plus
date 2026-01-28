import { useCallback, useRef } from 'react'
import ToolbarDesktop from '@components/TipTap/toolbar/ToolbarDesktop'
import EditorContent from './EditorContent'
import TOC from './Toc'
import { useAdjustEditorSizeForChatRoom, useTOCResize } from '../hooks'
import { useUnreadSync } from '@hooks/useUnreadSync'
import { Chatroom } from '@components/chatroom'
import { HoverMenu } from '@components/ui/HoverMenu'
import ResizeHandle from '@components/ui/ResizeHandle'
import { useMessageFeedContext } from '@components/chatroom/components/MessageFeed/MessageFeedContext'
import { useHeadingScrollSpy } from '@components/toc/hooks'

const MessageHoverMenu = (props: React.ComponentProps<typeof HoverMenu>) => {
  const { virtualizerRef, messageContainerRef } = useMessageFeedContext()

  const getScrollParent = useCallback(() => {
    const virtualizer = virtualizerRef.current
    const scrollElement = virtualizer?.scrollElement

    if (scrollElement && 'nodeType' in scrollElement) {
      return scrollElement as Element
    }

    return messageContainerRef.current ?? null
  }, [virtualizerRef, messageContainerRef])

  return <HoverMenu {...props} scrollParent={getScrollParent} />
}

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  // Hook for TOC resize functionality
  const { tocRef, tocWidth, isResizing, handleMouseDown, editorContainerStyle } = useTOCResize()

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useUnreadSync()

  // IntersectionObserver-based scroll spy for TOC highlighting
  useHeadingScrollSpy(editorWrapperRef)

  return (
    <>
      {/* Toolbar - Design System: bg-base-100 for primary canvas elements */}
      <div className="toolbars bg-base-100 border-base-300 fixed bottom-0 z-[9] h-auto w-full border-t sm:relative sm:block sm:border-t-0">
        <ToolbarDesktop />
      </div>

      {/* Main editor layout - 3 panel structure */}
      <div className="editor bg-base-200 relative flex size-full flex-row-reverse justify-around align-top">
        {/* Editor + Chat container */}
        <div className="relative flex flex-col align-top" style={editorContainerStyle}>
          {/* Editor wrapper - Design System: bg-base-100 for editor canvas */}
          <div
            ref={editorWrapperRef}
            className="editorWrapper bg-base-100 flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4">
            <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
          </div>

          {/* Chatroom Panel */}
          <Chatroom variant="desktop">
            <Chatroom.Toolbar className="border-base-300 bg-base-100 relative z-50 flex w-full items-center gap-2 border-b px-2 py-1">
              <Chatroom.Toolbar.Breadcrumb />
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <Chatroom.Toolbar.ParticipantsList />
                <div className="bg-base-200 flex items-center rounded-md">
                  <Chatroom.Toolbar.ShareButton />
                  <Chatroom.Toolbar.NotificationToggle />
                  <Chatroom.Toolbar.CloseButton />
                </div>
              </div>
            </Chatroom.Toolbar>

            <Chatroom.MessageFeed showScrollToBottom={true}>
              <Chatroom.MessageFeed.MessageList>
                <Chatroom.MessageFeed.MessageList.ContextMenu>
                  <Chatroom.MessageFeed.MessageList.Loop>
                    {(message, index) => (
                      <Chatroom.MessageFeed.MessageList.MessageCard message={message} index={index}>
                        <MessageHoverMenu
                          id="message-actions"
                          placement="top-end"
                          offset={-10}
                          scrollParent={document.querySelector('.message-feed') ?? null}
                          className="w-full overflow-auto"
                          menu={<Chatroom.MessageFeed.MessageList.MessageCard.Actions.HoverMenu />}>
                          <Chatroom.MessageFeed.MessageList.MessageCard.Header.BookmarkIndicator />
                          <div className="flex w-full items-start gap-2">
                            {message.isGroupStart && (
                              <div className="relative flex flex-col items-center space-y-2">
                                <Chatroom.MessageFeed.MessageList.MessageCard.Header.UserAvatar />
                              </div>
                            )}
                            {message.isGroupStart ? (
                              <div className="flex w-full flex-col">
                                <Chatroom.MessageFeed.MessageList.MessageCard.Header className="flex items-center">
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Header.Username className="text-sm" />
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Header.Timestamp className="ml-1" />
                                </Chatroom.MessageFeed.MessageList.MessageCard.Header>
                                <div
                                  className={`!mt-0 flex w-full flex-col overflow-hidden text-[15px] font-normal antialiased`}>
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Content>
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Content.ReplyReference />
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Content.CommentReference />
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Content.MessageBody />
                                  </Chatroom.MessageFeed.MessageList.MessageCard.Content>
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Footer>
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators>
                                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.ReplyCount />
                                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge />
                                    </Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators>
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions>
                                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.AddReactionButton />
                                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.ReactionList />
                                    </Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions>
                                  </Chatroom.MessageFeed.MessageList.MessageCard.Footer>
                                </div>
                              </div>
                            ) : (
                              <div className="flex w-full flex-row items-center">
                                <div className="relative ml-3 flex flex-col items-center space-y-2">
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Header className="chat-header">
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Header.Timestamp />
                                  </Chatroom.MessageFeed.MessageList.MessageCard.Header>
                                </div>
                                <div
                                  className={`!mt-0 flex w-full flex-col overflow-hidden pl-2 text-[15px] font-normal antialiased`}>
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Content>
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Content.ReplyReference />
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Content.CommentReference />
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Content.MessageBody />
                                  </Chatroom.MessageFeed.MessageList.MessageCard.Content>
                                  <Chatroom.MessageFeed.MessageList.MessageCard.Footer>
                                    <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions>
                                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.AddReactionButton />
                                      <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions.ReactionList />
                                      <div className="mt-auto ml-auto flex justify-end">
                                        <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators>
                                          <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.ReplyCount />
                                          <Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators.EditedBadge />
                                        </Chatroom.MessageFeed.MessageList.MessageCard.Footer.Indicators>
                                      </div>
                                    </Chatroom.MessageFeed.MessageList.MessageCard.Footer.Reactions>
                                  </Chatroom.MessageFeed.MessageList.MessageCard.Footer>
                                </div>
                              </div>
                            )}
                          </div>
                        </MessageHoverMenu>
                      </Chatroom.MessageFeed.MessageList.MessageCard>
                    )}
                  </Chatroom.MessageFeed.MessageList.Loop>
                </Chatroom.MessageFeed.MessageList.ContextMenu>
              </Chatroom.MessageFeed.MessageList>
            </Chatroom.MessageFeed>
            <Chatroom.ChannelComposer className="w-full" />
          </Chatroom>
        </div>

        {/* TOC Sidebar - Design System: bg-base-200 for side panels */}
        <div
          ref={tocRef}
          className="tableOfContents bg-base-200 relative h-full max-h-full"
          style={{ width: tocWidth }}>
          {/* Resize Handle - Design System compliant */}
          <ResizeHandle
            orientation="vertical"
            onMouseDown={handleMouseDown}
            isResizing={isResizing}
          />
          <TOC />
        </div>
      </div>
    </>
  )
}

export default DesktopEditor
