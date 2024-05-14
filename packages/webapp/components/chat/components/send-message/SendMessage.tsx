import { EditorContent } from '@tiptap/react'
import { EditorToolbar } from './EditorToolbar'
import { ReplayMessageIndicator } from './ReplayMessageIndicator'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { twx, cn } from '@utils/index'
import { ImAttachment } from 'react-icons/im'
import { IoSend } from 'react-icons/io5'
import { MdFormatColorText } from 'react-icons/md'
import { BsFillEmojiSmileFill } from 'react-icons/bs'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { sendMessage, updateMessage, create_thread_message } from '@api'
import { useApi } from '@hooks/useApi'
import { EditeMessageIndicator } from './EditeMessageIndicator'
import { useTiptapEditor } from './Editor'
import { chunkHtmlContent } from '@utils/index'
import { useChannel } from '../../context/ChannelProvider'
import { messageInsert } from '../../hooks/listner/helpers'
import * as toast from '@components/toast'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((prop) =>
  cn(
    'btn btn-ghost w-8 h-8 btn-xs p-1 mr-2',
    prop.$active && 'btn-active',
    prop.$size && `w-${prop.$size} h-${prop.$size}`
  )
)

export default function SendMessage() {
  const { channelId } = useChannel()

  const [showEditorToolbar, setShowEditorToolbar] = useState(false)
  const setEditMessageMemory = useChatStore((state) => state.setEditMessageMemory)
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const startThreadMessage = useChatStore((state) => state.startThreadMessage)
  const channels = useChatStore((state) => state.channels)

  const user = useAuthStore((state: any) => state.profile)
  const { workspaceId } = useChatStore((state: any) => state.workspaceSettings)
  const channelSettings = useChatStore((state: any) =>
    state.workspaceSettings.channels.get(channelId)
  )
  const { replayMessageMemory, editMessageMemory } = channelSettings || {}

  const setOrUpdateUserPresence = useChatStore((state: any) => state.setOrUpdateUserPresence)
  const usersPresence = useStore((state: any) => state.usersPresence)
  const { request: postRequestMessage, loading: postMsgLoading } = useApi(sendMessage, null, false)
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
    return postMsgLoading || editMsgLoading || postThreadMsgLoading
  }, [postMsgLoading, editMsgLoading, postThreadMsgLoading])

  const { editor, text, html } = useTiptapEditor({ loading })

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

  const submit = useCallback(async () => {
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
      editor?.commands.clearContent(true)

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
        } else {
          messageInsert(fakemessage)
          postRequestMessage(text, channelId, user.id, html, messageId)
        }
        return
      }

      // INFO: order to send message is important
      for (const [index, htmlChunk] of htmlChunks.entries()) {
        const textChunk = textChunks[index]
        if (editMessageMemory) {
          editeRequestMessage(textChunk, htmlChunk, messageId)
        } else {
          postRequestMessage(textChunk, channelId, user.id, htmlChunk, messageId)
        }
      }
    } catch (error: any) {
      toast.Error(error.message)
    } finally {
      // clear the editor
      document.dispatchEvent(new CustomEvent('messages:container:scroll:down'))
      // if it has reply or forward message, clear it
      if (replayMessageMemory) setReplayMessageMemory(channelId, null)
      if (editMessageMemory) setEditMessageMemory(channelId, null)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, text, html])

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

  if (!editor || !user) return null

  return (
    <div className="flex w-full flex-col bg-base-200 p-1 px-2 pb-0 ">
      <ReplayMessageIndicator />
      <EditeMessageIndicator />
      <EditorToolbar
        editor={editor}
        className=" px-2"
        style={{ display: showEditorToolbar ? 'flex' : 'none' }}
      />

      <div
        className={`my-2 mt-1 w-full px-2${showEditorToolbar ? 0 : 2}`}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}>
        <div className="flex w-full flex-col  rounded-md bg-base-300 px-3">
          <div className="flex items-end py-2 text-base">
            <IconButton $size={8}>
              <ImAttachment size={20} />
            </IconButton>

            <EditorContent className="max-h-52 w-full overflow-auto" editor={editor} dir="auto" />

            <IconButton
              $size={8}
              className={showEditorToolbar ? 'bg-secondary text-secondary-content' : ''}
              onClick={() => setShowEditorToolbar(!showEditorToolbar)}>
              <MdFormatColorText size={24} />
            </IconButton>

            <IconButton $size={8} onClick={openEmojiPicker}>
              <BsFillEmojiSmileFill size={22} />
            </IconButton>

            <IconButton
              $size={8}
              onClick={submit}
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
