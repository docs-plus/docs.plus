import { useRef } from 'react'
import ToolbarDesktop from '@components/TipTap/toolbar/ToolbarDesktop'
import EditorContent from './EditorContent'
import TOC from './Toc'
import { useAdjustEditorSizeForChatRoom, useTOCResize, useScrollSyncToc } from '../hooks'
import useUpdateDocPageUnreadMsg from '../hooks/useUpdateDocPageUnreadMsg'
import { Chatroom } from '@components/chatroom'
import { HoverMenu } from '@components/ui/HoverMenu'

const DesktopEditor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  // Hook for TOC resize functionality
  const { tocRef, tocWidth, handleMouseDown, editorContainerStyle } = useTOCResize()

  // @ts-ignore
  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useUpdateDocPageUnreadMsg()

  // Use the custom hook for scroll sync -> TOC
  useScrollSyncToc(editorWrapperRef)

  return (
    <>
      <div className="toolbars fixed bottom-0 z-[9] h-auto w-full bg-white sm:relative sm:block">
        <ToolbarDesktop />
      </div>
      <div className="editor relative flex size-full flex-row-reverse justify-around align-top">
        <div className="relative flex flex-col align-top" style={editorContainerStyle}>
          <div
            ref={editorWrapperRef}
            className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4">
            <EditorContent className="mb-12 border-t-0 px-6 pt-8 sm:mb-0 sm:p-8" />
          </div>
          {/* <ChatContainer /> */}
          <Chatroom variant="desktop">
            <Chatroom.Toolbar className="relative z-50 flex w-full items-center border-b border-gray-300 bg-white p-2">
              <Chatroom.Toolbar.Breadcrumb className="px-1" />
              <div className="ml-auto flex items-center gap-3">
                <Chatroom.Toolbar.ParticipantsList className="flex h-9 items-center" />
                <div className="join bg-base-300 rounded-md">
                  <Chatroom.Toolbar.ShareButton className="join-item" />
                  <Chatroom.Toolbar.NotificationToggle className="join-item" />
                  <Chatroom.Toolbar.CloseButton className="join-item" />
                </div>
              </div>
            </Chatroom.Toolbar>

            <Chatroom.MessageFeed showScrollToBottom={true}>
              <Chatroom.MessageFeed.MessageList>
                <Chatroom.MessageFeed.MessageList.ContextMenu>
                  <Chatroom.MessageFeed.MessageList.Loop>
                    {(message, index) => (
                      <Chatroom.MessageFeed.MessageList.MessageCard message={message} index={index}>
                        <HoverMenu
                          id="message-actions"
                          placement="top-end"
                          scrollParent={() => document.querySelector('.message-feed')}
                          offset={-10}
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
                                <Chatroom.MessageFeed.MessageList.MessageCard.Header>
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
                        </HoverMenu>
                      </Chatroom.MessageFeed.MessageList.MessageCard>
                    )}
                  </Chatroom.MessageFeed.MessageList.Loop>
                </Chatroom.MessageFeed.MessageList.ContextMenu>
              </Chatroom.MessageFeed.MessageList>
            </Chatroom.MessageFeed>
            <Chatroom.ChannelComposer className="w-full" />
          </Chatroom>
        </div>
        <div
          ref={tocRef}
          className="tableOfContents relative h-full max-h-full"
          style={{
            width: tocWidth
          }}>
          <div
            onMouseDown={handleMouseDown}
            className="absolute top-0 right-0 z-10 h-full w-[1px] cursor-col-resize bg-gray-300 select-none"
          />
          <TOC />
        </div>
      </div>
    </>
  )
}

export default DesktopEditor
