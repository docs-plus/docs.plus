import { EditorContent } from '@tiptap/react'
import { EditorToolbar } from './EditorToolbar'
import { ReplyMessageIndicator } from './ReplyMessageIndicator'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { twx, cn, sanitizeMessageContent, sanitizeChunk } from '@utils/index'
import { ImAttachment } from 'react-icons/im'
import { IoSend } from 'react-icons/io5'
import { MdFormatColorText } from 'react-icons/md'
import { BsFillEmojiSmileFill } from 'react-icons/bs'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { sendMessage, updateMessage, create_thread_message, sendCommentMessage } from '@api'
import { useApi } from '@hooks/useApi'
import { EditeMessageIndicator } from './EditeMessageIndicator'
import { useTiptapEditor } from './Editor'
import { chunkHtmlContent } from '@utils/index'
import { useChannel } from '../../context/ChannelProvider'
import { messageInsert } from '../../hooks/listner/helpers'
import * as toast from '@components/toast'
import { CommentMessageIndicator } from './CommentMessageIndicator'
import { TChannelSettings } from '@types'
import ToolbarButton from '@components/TipTap/toolbar/ToolbarButton'
import { RiAtLine } from 'react-icons/ri'
import { MdOutlineEmojiEmotions } from 'react-icons/md'

type BtnIcon = React.ComponentProps<'button'> & {
  $active?: boolean
  $size?: number
  $className?: string
}

const IconButton = twx.button<BtnIcon>((prop) =>
  cn(
    'btn btn-ghost btn-square p-1 ',
    prop.$active && 'btn-active',
    prop.$size && `w-${prop.$size} h-${prop.$size}`,
    prop.$className || ''
  )
)

export default function SendMessage() {
  const { channelId, settings } = useChannel()
  const editorElement = useRef<HTMLDivElement>(null)

  const [showEditorToolbar, setShowEditorToolbar] = useState(false)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplyMessageMemory = useChatStore((state) => state.setReplyMessageMemory)
  const setCommentMessageMemory = useChatStore((state) => state.setCommentMessageMemory)
  const startThreadMessage = useChatStore((state) => state.startThreadMessage)
  const channels = useChatStore((state) => state.channels)

  const user = useAuthStore((state) => state.profile)
  const { workspaceId } = useChatStore((state) => state.workspaceSettings)
  const chatChannels = useChatStore((state) => state.workspaceSettings.channels)
  const channelSettings = useMemo<TChannelSettings | null>(
    () => chatChannels.get(channelId) ?? null,
    [chatChannels, channelId]
  )

  const { replyMessageMemory, editMessageMemory, commentMessageMemory } = channelSettings || {}

  const setOrUpdateUserPresence = useChatStore((state: any) => state.setOrUpdateUserPresence)
  const usersPresence = useStore((state: any) => state.usersPresence)
  const { request: postRequestMessage, loading: postMsgLoading } = useApi(sendMessage, null, false)
  const { request: commentRequestMessage, loading: commentMsgLoading } = useApi(
    sendCommentMessage,
    null,
    false
  )
  const { request: editeRequestMessage, loading: editMsgLoading } = useApi(
    updateMessage,
    null,
    false
  )

  const { request: postRequestThreadMessage, loading: postThreadMsgLoading } = useApi(
    create_thread_message,
    null,
    false
  )

  const loading = useMemo(() => {
    return postMsgLoading || editMsgLoading || commentMsgLoading || postThreadMsgLoading
  }, [postMsgLoading, editMsgLoading, commentMsgLoading, postThreadMsgLoading])

  const { editor, text, html } = useTiptapEditor({ loading })

  // set the editor content if it is a reply message
  useEffect(() => {
    if (!editor || !editMessageMemory || editMessageMemory.channel_id !== channelId) return

    const content = editMessageMemory.html || editMessageMemory.content
    if (!content) return

    editor.chain().setContent(content).focus('start').run()
  }, [editor, editMessageMemory, channelId])

  const submit = useCallback(
    async (e: any) => {
      if (!editor || !user) return

      e.preventDefault()
      editor.view.focus()

      const isContentEmpty =
        !html || !text || html.replace(/<[^>]*>/g, '').trim() === '' || text.trim() === ''

      if (isContentEmpty || loading) return

      // Sanitize inputs to prevent XSS and injection attacks
      const { sanitizedHtml, sanitizedText } = sanitizeMessageContent(html, text)

      // Validate sanitized content
      if (!sanitizedHtml || !sanitizedText) {
        toast.Error('Invalid content detected')
        return
      }

      const { htmlChunks, textChunks } = chunkHtmlContent(sanitizedHtml, 3000)

      if (replyMessageMemory?.id) {
        const user = replyMessageMemory.user_details
        if (!usersPresence.has(user.id)) setOrUpdateUserPresence(user.id, user)
      }

      if (editMessageMemory?.id) {
        const user = editMessageMemory.user_details
        if (!usersPresence.has(user.id)) setOrUpdateUserPresence(user.id, user)
      }

      const messageId = editMessageMemory?.id || replyMessageMemory?.id || null

      try {
        editor.commands.clearContent(true)

        // first display fake message, then send the message
        // in insert message, we will remove the fake message
        const currentDate = new Date().toISOString()
        const fakemessage = {
          new: {
            id: 'fake_id',
            content: sanitizedText,
            html: sanitizedHtml,
            user_details: user,
            channel_id: channelId,
            user_id: user.id,
            created_at: currentDate,
            updated_at: currentDate
          }
        }

        if (htmlChunks.length === 0) {
          if (!messageId && startThreadMessage && startThreadMessage.id === channelId) {
            const threadId = startThreadMessage.id
            fakemessage.new.channel_id = threadId
            if (channels.has(threadId)) {
              messageInsert(fakemessage)
            }
            postRequestThreadMessage({
              p_content: sanitizedText,
              p_html: sanitizedHtml,
              p_thread_id: threadId,
              p_workspace_id: workspaceId
            })
          } else if (editMessageMemory) {
            editeRequestMessage(sanitizedText, sanitizedHtml, messageId)
          } else if (commentMessageMemory) {
            commentRequestMessage(sanitizedText, channelId, user.id, sanitizedHtml, {
              content: commentMessageMemory.content,
              html: commentMessageMemory.html
            })
          } else {
            messageInsert(fakemessage)
            // postRequestMessage(sanitizedText, channelId, user.id, sanitizedHtml, messageId)
            sendMessage(sanitizedText, channelId, user.id, sanitizedHtml, messageId)
          }
          editor.view.focus() // Refocus the editor to keep the keyboard open on mobile
          editor.commands.focus()
          return
        }

        // INFO: order to send message is important
        // Re-sanitize chunks to ensure each chunk is safe
        for (const [index, htmlChunk] of htmlChunks.entries()) {
          const textChunk = textChunks[index]
          const { sanitizedHtmlChunk, sanitizedTextChunk } = sanitizeChunk(htmlChunk, textChunk)

          if (editMessageMemory) {
            editeRequestMessage(sanitizedTextChunk, sanitizedHtmlChunk, messageId)
          } else if (commentMessageMemory) {
            commentRequestMessage(sanitizedTextChunk, channelId, user.id, sanitizedHtmlChunk, {
              content: commentMessageMemory.content,
              html: commentMessageMemory.html
            })
          } else {
            postRequestMessage(
              sanitizedTextChunk,
              channelId,
              user.id,
              sanitizedHtmlChunk,
              messageId
            )
          }
        }
      } catch (error: any) {
        toast.Error(error.message)
      } finally {
        // clear the editor
        // Refocus the editor to keep the keyboard open on mobile
        editor.view.focus()
        editor.commands.focus()

        // if it has reply or forward message, clear it
        if (replyMessageMemory) setReplyMessageMemory(channelId, null)
        if (editMessageMemory) setEditMessageMemory(channelId, null)
        if (commentMessageMemory) setCommentMessageMemory(channelId, null)

        document.dispatchEvent(new CustomEvent('messages:container:scroll:down'))
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user, text, html, editor, channelId, loading, setOrUpdateUserPresence]
  )

  const openEmojiPicker = (clickEvent: any) => {
    const event = new CustomEvent('toggelEmojiPicker', {
      detail: { clickEvent: clickEvent, editor, type: 'inserEmojiToEditor' }
    })
    document.dispatchEvent(event)
  }

  // Handler for the ESC key
  const handleEsc = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (replyMessageMemory) setReplyMessageMemory(channelId, null)
        if (editMessageMemory) {
          setEditMessageMemory(channelId, null)
          editor?.commands.clearContent(true)
        }
        if (commentMessageMemory) {
          setCommentMessageMemory(channelId, null)
          editor?.commands.clearContent(true)
        }
      }
    },
    [replyMessageMemory, editMessageMemory]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleEsc)
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [handleEsc])

  useEffect(() => {
    const handleEditorSubmit = () => {
      submit({ preventDefault: () => {} })
    }

    document.addEventListener('editor:submit', handleEditorSubmit)
    return () => {
      document.removeEventListener('editor:submit', handleEditorSubmit)
    }
  }, [submit])

  // const handleKeyDown = (e: React.KeyboardEvent) => {
  //   if (e.key === 'Enter' && !e.shiftKey) {
  //     if (!editor) return
  //     // Check if popup exists and is visible
  //     const tippyInstance = document.querySelector('[data-tippy-root]')
  //     const isPopupVisible =
  //       tippyInstance && window.getComputedStyle(tippyInstance).visibility === 'visible'

  //     if (isPopupVisible) {
  //       e.preventDefault()
  //       return
  //     }

  //     e.preventDefault()
  //     submit(e)
  //   }
  //   return
  // }

  useEffect(() => {
    // TODO: this is temporary
    setTimeout(() => {
      document.querySelector('.tiptap.ProseMirror')?.setAttribute('inputmode', 'text')
      document.querySelector('.tiptap.ProseMirror')?.setAttribute('enterkeyhint', 'send')
    }, 1000)
  }, [editor])

  useEffect(() => {
    const setAttributes = () => {
      const firstChild = editorElement.current?.firstChild as HTMLElement | null
      if (firstChild) {
        firstChild.setAttribute('inputmode', 'text')
        firstChild.setAttribute('enterkeyhint', 'send')
      }
    }
    setAttributes()
  }, [editor])

  if (!editor || !user) return null

  return (
    <div className="chat_editor_container mb-2 flex w-full flex-col bg-transparent">
      <CommentMessageIndicator />
      <ReplyMessageIndicator />
      <EditeMessageIndicator />

      <div className={`w-full`}>
        <div className="flex w-full flex-col rounded-md border border-gray-300 shadow-md">
          <EditorToolbar
            editor={editor}
            className={`rounded-tl-md rounded-tr-md border px-1 sm:px-2 ${showEditorToolbar ? 'flex' : 'hidden'}`}
          />

          <div className="flex flex-col gap-1 text-base">
            {/* {settings?.textEditor?.attachmentButton && (
              <IconButton $size={8}>
                <ImAttachment size={20} />
              </IconButton>
            )} */}
            <div className="flex-1 px-1 py-2 text-base sm:px-2">
              <EditorContent
                ref={editorElement}
                className="max-h-52 w-full overflow-auto"
                editor={editor}
                dir="auto"
              />
            </div>
            <div className="flex items-center gap-1 px-1 pb-1 sm:px-2">
              {settings?.textEditor?.toolbar && (
                <ToolbarButton
                  className={`tooltip-top ${showEditorToolbar ? 'btn-active' : ''}`}
                  tooltip="Toolbar"
                  onClick={() => setShowEditorToolbar(!showEditorToolbar)}>
                  <MdFormatColorText size={20} />
                </ToolbarButton>
              )}
              {settings?.textEditor?.emojiPicker && (
                <ToolbarButton onClick={openEmojiPicker} className="tooltip-top" tooltip="Emoji">
                  <MdOutlineEmojiEmotions size={20} />
                </ToolbarButton>
              )}

              {settings?.textEditor?.mentionsomeone && (
                <ToolbarButton
                  onClick={() => editor.chain().focus().insertContent('@').run()}
                  editor={editor}
                  type="mention"
                  tooltip="Mention someone"
                  className="tooltip-top">
                  <RiAtLine size={20} />
                </ToolbarButton>
              )}

              <ToolbarButton
                onClick={submit}
                type="submit"
                disabled={loading || editor.isEmpty}
                className="btn-docy btn-primary !mr-0 ml-auto p-1.5 hover:border-none sm:mr-2">
                <IoSend size={24} />
              </ToolbarButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
