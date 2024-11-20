import { EditorContent } from '@tiptap/react'
import { EditorToolbar } from './EditorToolbar'
import { ReplayMessageIndicator } from './ReplayMessageIndicator'
import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { twx, cn } from '@utils/index'
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

type BtnIcon = React.ComponentProps<'button'> & {
  $active?: boolean
  $size?: number
  $className?: string
}

const IconButton = twx.button<BtnIcon>((prop) =>
  cn(
    'btn btn-ghost w-8 h-8 btn-xs p-1 ',
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
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
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

  const { replayMessageMemory, editMessageMemory, commentMessageMemory } = channelSettings || {}

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
    if (!editor) return
    if (editMessageMemory?.channel_id !== channelId) return

    editor
      .chain()
      .insertContent(editMessageMemory?.html || editMessageMemory?.content || '', {
        parseOptions: {
          preserveWhitespace: false
        }
      })
      .focus('end')
      .run()
  }, [editor, editMessageMemory])

  const submit = useCallback(
    async (e: any) => {
      if (!editor || !user) return

      e.preventDefault()
      editor.view.focus()

      if (!html || !text || loading) return
      const { htmlChunks, textChunks } = chunkHtmlContent(html, 3000)

      if (replayMessageMemory?.id) {
        const user = replayMessageMemory.user_details
        if (!usersPresence.has(user.id)) setOrUpdateUserPresence(user.id, user)
      }

      if (editMessageMemory?.id) {
        const user = editMessageMemory.user_details
        if (!usersPresence.has(user.id)) setOrUpdateUserPresence(user.id, user)
      }

      const messageId = editMessageMemory?.id || replayMessageMemory?.id || null

      try {
        editor.commands.clearContent(true)

        // first display fake message, then send the message
        // in insert message, we will remove the fake message
        const currentDate = new Date().toISOString()
        const fakemessage = {
          new: {
            id: 'fake_id',
            content: text,
            html: html,
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
              p_content: text,
              p_html: html,
              p_thread_id: threadId,
              p_workspace_id: workspaceId
            })
          } else if (editMessageMemory) {
            editeRequestMessage(text, html, messageId)
          } else if (commentMessageMemory) {
            commentRequestMessage(text, channelId, user.id, html, {
              content: commentMessageMemory.content,
              html: commentMessageMemory.html
            })
          } else {
            messageInsert(fakemessage)
            // postRequestMessage(text, channelId, user.id, html, messageId)
            sendMessage(text, channelId, user.id, html, messageId)
          }
          editor.view.focus() // Refocus the editor to keep the keyboard open on mobile
          editor.commands.focus()
          return
        }

        // INFO: order to send message is important
        for (const [index, htmlChunk] of htmlChunks.entries()) {
          const textChunk = textChunks[index]
          if (editMessageMemory) {
            editeRequestMessage(textChunk, htmlChunk, messageId)
          } else if (commentMessageMemory) {
            commentRequestMessage(textChunk, channelId, user.id, htmlChunk, {
              content: commentMessageMemory.content,
              html: commentMessageMemory.html
            })
          } else {
            postRequestMessage(textChunk, channelId, user.id, htmlChunk, messageId)
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
        if (replayMessageMemory) setReplayMessageMemory(channelId, null)
        if (editMessageMemory) setEditMessageMemory(channelId, null)
        if (commentMessageMemory) setCommentMessageMemory(channelId, null)

        document.dispatchEvent(new CustomEvent('messages:container:scroll:down'))
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [user, text, html, editor, channelId, loading]
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
        if (replayMessageMemory) setReplayMessageMemory(channelId, null)
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
    [replayMessageMemory, editMessageMemory]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleEsc)
    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [handleEsc])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(e)
    }
  }

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
    <div className="flex w-full flex-col bg-base-200 p-1 px-2 pb-0">
      <CommentMessageIndicator />
      <ReplayMessageIndicator />
      <EditeMessageIndicator />
      <EditorToolbar
        editor={editor}
        className="px-2"
        style={{ display: showEditorToolbar ? 'flex' : 'none' }}
      />

      <div
        className={`my-2 mt-1 w-full px-2${showEditorToolbar ? 0 : 2}`}
        onKeyDown={(e) => handleKeyDown(e)}>
        <div className="flex w-full flex-col rounded-md bg-base-300 px-2 sm:px-3">
          <div className="flex items-center py-1 text-base sm:py-2">
            {settings?.textEditor?.attachmentButton && (
              <IconButton $size={8}>
                <ImAttachment size={20} />
              </IconButton>
            )}
            <EditorContent
              ref={editorElement}
              className="max-h-52 w-full overflow-auto"
              editor={editor}
              dir="auto"
            />
            {settings?.textEditor?.toolbar && (
              <IconButton
                $size={8}
                className={showEditorToolbar ? 'bg-secondary text-secondary-content' : ''}
                onClick={() => setShowEditorToolbar(!showEditorToolbar)}>
                <MdFormatColorText size={24} />
              </IconButton>
            )}
            {settings?.textEditor?.emojiPicker && (
              <IconButton $size={8} onClick={openEmojiPicker}>
                <BsFillEmojiSmileFill size={22} />
              </IconButton>
            )}
            <IconButton
              $size={8}
              onClick={submit}
              $className="sm:mr-2 !mr-0"
              type="submit"
              disabled={loading || editor.isEmpty}>
              <IoSend size={22} />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  )
}
