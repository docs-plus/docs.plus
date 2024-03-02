/* eslint-disable no-use-before-define */
// @ts-nocheck

import { EditorContent } from '@tiptap/react'
import { EditorToolbar } from './EditorToolbar'
import { ReplayMessageIndicator } from './ReplayMessageIndicator'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { twx, cn } from '@utils/twx'
import { ImAttachment } from 'react-icons/im'
import { IoSend } from 'react-icons/io5'
import { MdFormatColorText } from 'react-icons/md'
import { BsFillEmojiSmileFill } from 'react-icons/bs'
import { useStore, useAuthStore, useChatStore } from '@stores'
import { sendMessage, updateMessage } from '@api'
import { useApi } from '@hooks/useApi'
import toast from 'react-hot-toast'
import { EditeMessageIndicator } from './EditeMessageIndicator'
import { useTiptapEditor } from './Editor'
import { chunkHtmlContent } from '@utils/chunkHtmlContent'

type BtnIcon = React.ComponentProps<'button'> & { $active?: boolean; $size?: number }

const IconButton = twx.button<BtnIcon>((prop: { $active: any; $size: any }) =>
  cn(
    'btn btn-ghost w-8 h-8 btn-xs p-1 mr-2',
    prop.$active && 'btn-active',
    prop.$size && `w-${prop.$size} h-${prop.$size}`
  )
)

export default function SendMessage() {
  const [showEditorToolbar, setShowEditorToolbar] = useState(false)
  const setReplayMessageMemory = useChatStore((state) => state.setReplayMessageMemory)
  const setEditeMessageMemory = useChatStore((state) => state.setEditeMessageMemory)
  const { replayMessageMemory, editeMessageMemory } = useChatStore((state) => state.chatRoom)

  const user = useAuthStore((state: any) => state.profile)
  const { headingId: channelId } = useChatStore((state) => state.chatRoom)

  const setOrUpdateUserPresence = useStore((state: any) => state.setOrUpdateUserPresence)
  const usersPresence = useStore((state: any) => state.usersPresence)
  const { request: postRequestMessage, loading: postMsgLoading } = useApi(sendMessage, null, false)
  const { request: editeRequestMessage, loading: editMsgLoading } = useApi(
    updateMessage,
    null,
    false
  )

  const loading = useMemo(() => {
    return postMsgLoading || editMsgLoading
  }, [postMsgLoading, editMsgLoading])

  const { editor, text, html } = useTiptapEditor({ loading })

  useEffect(() => {
    if (!editor) return

    editor
      .chain()
      .insertContent(editeMessageMemory?.html || editeMessageMemory?.content || '', {
        parseOptions: {
          preserveWhitespace: false
        }
      })
      .focus('end')
      .run()
  }, [editor, editeMessageMemory])

  const submit = useCallback(async () => {
    if (!html || !text || loading) return
    const { htmlChunks, textChunks } = chunkHtmlContent(html, 3000)

    if (replayMessageMemory?.id) {
      const user = replayMessageMemory.user_details
      if (!usersPresence.has(user.id)) setOrUpdateUserPresence(user.id, user)
    }

    if (editeMessageMemory?.id) {
      const user = editeMessageMemory.user_details
      if (!usersPresence.has(user.id)) setOrUpdateUserPresence(user.id, user)
    }

    const messageId = editeMessageMemory?.id || replayMessageMemory?.id || null

    try {
      editor?.commands.clearContent(true)

      if (htmlChunks.length === 0) {
        if (editeMessageMemory) {
          editeRequestMessage(text, html, messageId)
        } else {
          postRequestMessage(text, channelId, user.id, html, messageId)
        }
        return
      }

      // INFO: order to send message is important
      for (const [index, htmlChunk] of htmlChunks.entries()) {
        const textChunk = textChunks[index]
        if (editeMessageMemory) {
          editeRequestMessage(textChunk, htmlChunk, messageId)
        } else {
          postRequestMessage(textChunk, channelId, user.id, htmlChunk, messageId)
        }
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      // clear the editor
      document.dispatchEvent(new CustomEvent('messages:container:scroll:down'))
      // if it has reply or forward message, clear it
      if (replayMessageMemory) setReplayMessageMemory(null)
      if (editeMessageMemory) setEditeMessageMemory(null)
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
        if (replayMessageMemory) setReplayMessageMemory(null)
        if (editeMessageMemory) {
          setEditeMessageMemory(null)
          editor?.commands.clearContent(true)
        }
      }
    },
    [replayMessageMemory, editeMessageMemory]
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
    <div className="flex w-full  flex-col  bg-base-200 p-1 px-2 pb-0 ">
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
        <div className=" w-full  rounded-md bg-base-300 px-3">
          <div className="flex items-end py-2 text-base">
            <IconButton $size={8}>
              <ImAttachment size={20} />
            </IconButton>

            <EditorContent className="w-full  overflow-hidden" editor={editor} dir="auto" />

            <IconButton $size={8} onClick={() => setShowEditorToolbar(!showEditorToolbar)}>
              <MdFormatColorText size={22} />
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
