import { useEffect, useState, useRef, use } from 'react'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import EditorContent from './EditorContent'
import { Pencil } from '@icons'
import ToolbarMobile from './ToolbarMobile'
import TocModal from '@components/pages/document/components/TocModal'
import { useStore, useChatStore } from '@stores'
import ChatontainerMobile from './chat/ChatontainerMobile'
import { scrollHeadingSelection } from '../helpers'
import { useAdjustEditorSizeForChatRoom } from '../hooks'

const getIOSWindowHeight = function () {
  const zoomLevel = document.documentElement.clientWidth / window.innerWidth
  return window.innerHeight * zoomLevel
}

const getHeightOfIOSToolbars = function () {
  const tH = (window.orientation === 0 ? screen.height : screen.width) - getIOSWindowHeight()
  return tH > 1 ? tH : 0
}

const Editor = () => {
  const editorWrapperRef = useRef<HTMLDivElement>(null)

  const chatRoom = useChatStore((state) => state.chatRoom)

  const {
    deviceDetect,
    editor: { instance: editor, isMobile, selectionPos, loading }
  } = useStore((state) => state.settings)

  const [showToolbar, setShowToolbar] = useState(false)
  const isKeyboardOpen = useDetectKeyboardOpen() || false

  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  // we need this for first init
  useEffect(() => {
    if (!editor) return

    setTimeout(() => {
      if (isKeyboardOpen) return
      const divProseMirror = document.querySelector('.tiptap.ProseMirror')
      divProseMirror?.setAttribute('contenteditable', 'false')
      editor?.setEditable(false)
    }, 500)
  }, [deviceDetect, editor, isKeyboardOpen, loading])

  useEffect(() => {
    // @ts-ignore
    document.querySelector('html').style.height = window.visualViewport.height + 'px'
    // @ts-ignore
    document.body.style.height = window.visualViewport.height + 'px'
  }, [isKeyboardOpen])

  useEffect(() => {
    const viewportHandler = (event: any) => {
      // if (isHandled) return // Prevent multiple executions

      event.preventDefault()
      // if (!isKeyboardOpen) return

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

      const toolbar = document.querySelector('.toolbars .tiptap__toolbar')
      const viewport = event.target
      const viewportHeight = Math.trunc(viewport.height)

      // document.body.style.height = `${viewportHeight}px`

      const htmlElement = document.querySelector('html') as HTMLElement

      // in this situation, the height of the html element is the height of the viewport
      // in this situation, the pageTop need for calculation
      if (htmlElement) {
        htmlElement.style.height = `${viewportHeight + viewport.pageTop}px`
        document.body.style.height = `${viewportHeight + viewport.pageTop}px`
      }

      const toolbars = document.querySelector('.toolbars .tiptap__toolbar') as HTMLElement
      if (toolbars) {
        toolbars.style.top = `${Math.trunc(viewport.clientHeight)}px`
      }

      const selection = window?.getSelection()?.anchorNode?.parentElement
      if (!selection) return

      if (deviceDetect.is('iPhone')) {
        if (event.type !== 'scroll') {
          window.scrollTo({ top: 0, left: 0, behavior: 'instant' })

          setTimeout(() => {
            selection?.scrollIntoView({
              behavior: 'auto',
              block: 'center',
              inline: 'nearest'
            })
          }, 100)
        }
      }
    }

    window.visualViewport?.addEventListener('resize', viewportHandler)
    window.visualViewport?.addEventListener('scroll', viewportHandler)

    return () => {
      window.visualViewport?.removeEventListener('resize', viewportHandler)
      window.visualViewport?.removeEventListener('scroll', viewportHandler)
    }
  }, [deviceDetect])

  const toggleToolbar = () => {
    if (!isMobile) return

    if (!isKeyboardOpen) {
      const divProseMirror = document.querySelector('.tiptap.ProseMirror') as HTMLElement
      divProseMirror.setAttribute('contenteditable', 'true')
      editor?.setEditable(true)
    }

    editor
      ?.chain()
      .focus(selectionPos || 'start')
      .setTextSelection(selectionPos || 0)
      .scrollIntoView()

    setShowToolbar(!showToolbar)
  }

  return (
    <>
      <div className="editor relative flex size-full flex-row-reverse justify-around align-top">
        <div className="relative flex w-full max-w-full flex-col align-top">
          <div
            ref={editorWrapperRef}
            className="editorWrapper flex h-full grow items-start justify-center overflow-hidden overflow-y-auto border-t-0 p-0 "
            onScroll={!isMobile ? scrollHeadingSelection : undefined}>
            <EditorContent />
          </div>
        </div>
      </div>

      <ChatontainerMobile />

      <div className="relative z-0">
        <button
          onClick={toggleToolbar}
          className={`btn_bigBluePencil btn btn-circle btn-neutral flex size-14 ${!isKeyboardOpen ? 'active block' : 'hidden'} fixed bottom-8 right-6 z-10 `}>
          <Pencil size={26} />
        </button>
      </div>
      <div
        className={`toolbars fixed bottom-0 z-10 w-full bg-base-100 ${isKeyboardOpen && !chatRoom?.headingId ? 'block' : 'hidden'}`}>
        <ToolbarMobile />
      </div>
    </>
  )
}

export default Editor
