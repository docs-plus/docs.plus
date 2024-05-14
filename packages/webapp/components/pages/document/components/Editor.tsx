import { useEffect, useState, useRef } from 'react'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import Toolbar from '@components/TipTap/toolbar/Toolbar'
import useEditorAndProvider from '@hooks/useEditorAndProvider'
import EditorContent from './EditorContent'
import { Pencil } from '@icons'
import TOC from './Toc'
import ToolbarMobile from './ToolbarMobile'
import TocModal from './TocModal'
import { useStore, useChatStore } from '@stores'
import ChatContainer from './chat/ChatContainer'
import { scrollHeadingSelection } from '../helpers'
import { useAdjustEditorSizeForChatRoom } from '../hooks'

const Editor = () => {
  const { editor } = useEditorAndProvider()
  const editorWrapperRef = useRef<HTMLDivElement>(null)
  // Mobile specific code
  const {
    deviceDetect,
    editor: { isMobile, selectionPos }
  } = useStore((state) => state.settings)

  const chatRoom = useChatStore((state) => state.chatRoom)

  const [showToolbar, setShowToolbar] = useState(false)
  const isKeyboardOpen = useDetectKeyboardOpen()

  useAdjustEditorSizeForChatRoom(editorWrapperRef)

  useEffect(() => {
    if (!isMobile) return
    setShowToolbar(isKeyboardOpen)

    if (isKeyboardOpen) {
      console.info('keyboard is open')
      // editor?.setEditable(true)
      setShowToolbar(true)
    } else {
      // Make the editor read-only
      // editor?.setEditable(false)
      const divProseMirror = document.querySelector('.ProseMirror')
      divProseMirror?.setAttribute('contenteditable', 'false')
      console.info('keyboard is closed')
      setShowToolbar(false)
    }
  }, [isKeyboardOpen, editor])

  useEffect(() => {
    document?.querySelector('html')?.classList.add(isMobile ? 'm_mobile' : 'm_desktop')
    if (isMobile) {
      // I did in this way, in order to have much control on the editor on the Mobile
      // Make the editor read-only
      const divProseMirror = document.querySelector('.ProseMirror')
      divProseMirror?.setAttribute('contenteditable', 'false')

      const viewportHandler = (event: any) => {
        event.preventDefault()
        // need these two lines, in order to prevent to change viewport in IOS
        window.scrollTo({ top: 0 })
        document.body.scrollTop = 0

        const viewport = event.target
        const viewportHeight = Math.trunc(viewport.height - viewport.pageTop)

        document.body.style.height = `${viewportHeight}px`

        const htmlElement = document.querySelector('html') as HTMLElement
        if (htmlElement) {
          htmlElement.style.height = `${viewportHeight}px`
        }

        const toolbars = document.querySelector('.toolbars') as HTMLElement
        if (toolbars) {
          toolbars.style.top = `${Math.trunc(viewport.height) - 44}px`
        }

        const selection = window?.getSelection()?.anchorNode?.parentElement
        if (!selection) return
        if (deviceDetect.is('iPhone')) {
          if (event.type !== 'scroll') {
            selection?.scrollIntoView({
              behavior: 'instant',
              block: 'start'
            })
          }
        }
      }

      window.visualViewport?.addEventListener('resize', viewportHandler)
      window.visualViewport?.addEventListener('scroll', viewportHandler)

      return () => {
        window.visualViewport?.removeEventListener('resize', viewportHandler)
        window.visualViewport?.removeEventListener('scroll', viewportHandler)
      }
    }
  }, [isMobile])

  function toggleToolbar() {
    if (!isMobile) return
    if (!isKeyboardOpen) {
      // editor?.setEditable(true)
      const divProseMirror = document.querySelector('.ProseMirror') as HTMLElement
      divProseMirror.setAttribute('contenteditable', 'true')
    }

    editor
      ?.chain()
      .focus(selectionPos === 0 ? 'start' : selectionPos)
      .setTextSelection(selectionPos || 0)
      .scrollIntoView()
    setShowToolbar(!showToolbar)
  }

  return (
    <>
      <div className="toolbars fixed bottom-0 z-[9] h-auto w-full bg-white sm:relative sm:block">
        {!isMobile ? <Toolbar /> : isKeyboardOpen && <ToolbarMobile />}
      </div>
      <div className="editor relative flex size-full flex-row-reverse justify-around align-top ">
        <div className="relative flex w-[78%] max-w-full flex-col align-top ">
          <div
            ref={editorWrapperRef}
            className="editorWrapper flex h-full grow items-start justify-center overflow-y-auto border-t-0 p-0 sm:py-4"
            onScroll={!isMobile ? scrollHeadingSelection : undefined}>
            <EditorContent />
          </div>
          <ChatContainer />
        </div>
        {!isMobile && (
          <div
            className={`${chatRoom.headingId ? 'border-r border-gray-200 dark:border-gray-700' : ''} tableOfContents h-full max-h-full w-[22%]`}>
            <TOC />
          </div>
        )}
      </div>
      {isMobile && (
        <>
          <div className="nd_modal left fixed z-20 hidden size-full overflow-hidden">
            <TocModal />
          </div>
          <button
            onClick={toggleToolbar}
            className={`btn_bigBluePencil ${
              !isKeyboardOpen ? 'active block' : 'hidden'
            } fixed bottom-12 right-8 z-10 flex size-14 items-center justify-center rounded-full align-middle outline-none drop-shadow-md`}>
            <Pencil size={25} />
          </button>
        </>
      )}
    </>
  )
}

export default Editor
