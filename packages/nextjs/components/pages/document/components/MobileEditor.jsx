import Editor from './Editor'
import { use, useEffect, useState } from 'react'
import { useEditorStateContext } from '@context/EditorContext'
import { useRouter } from 'next/router'
import { useUser } from '@supabase/auth-helpers-react'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import { Pencil } from '@icons'
import ToolbarMobile from './ToolbarMobile'
import TocModal from '../components/TocModal'

import useEditorAndProvider from '@hooks/useEditorAndProvider'

const MobileEditor = ({ docMetadata }) => {
  const { rendering, loading, setLoading, deviceDetect, selectionPos, setSelectionPos } =
    useEditorStateContext()

  const [showToolbar, setShowToolbar] = useState(false)

  const isKeyboardOpen = useDetectKeyboardOpen()

  const { editor } = useEditorAndProvider({ docMetadata })

  useEffect(() => {
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
    if (!editor || loading) return

    document.querySelector('html').classList.add('m_mobile')

    // editor.on('selectionUpdate', ({ editor }) => {
    //   // The selection has changed.
    //   setSelectionPos(editor.state.selection.$anchor.pos)
    // })

    // Make the editor read-only
    const divProseMirror = document.querySelector('.ProseMirror')
    divProseMirror?.setAttribute('contenteditable', 'false')

    const viewportHandler = (event) => {
      event.preventDefault()
      // need these two lines, in order to prevent to change viewport in IOS
      window.scrollTo({ top: 0 })
      document.body.scrollTop = 0

      const viewport = event.target
      const viewportHeight = Math.trunc(viewport.height - viewport.pageTop)

      document.body.style.height = `${viewportHeight}px`
      document.querySelector('html').style.height = `${viewportHeight}px`

      document.querySelector('.toolbars').style.top = `${Math.trunc(viewport.height) - 44}px`

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

    window.visualViewport.addEventListener('resize', viewportHandler)
    window.visualViewport.addEventListener('scroll', viewportHandler)

    return () => {
      window.visualViewport.removeEventListener('resize', viewportHandler)
      window.visualViewport.removeEventListener('scroll', viewportHandler)
    }
  }, [editor, loading])

  function toggleToolbar() {
    if (!isKeyboardOpen) {
      // editor?.setEditable(true)
      const divProseMirror = document.querySelector('.ProseMirror')
      divProseMirror.setAttribute('contenteditable', 'true')
    }
    editor
      .chain()
      .focus(selectionPos === 0 ? 'start' : selectionPos)
      .setTextSelection(selectionPos)
      .scrollIntoView()

    setShowToolbar(!showToolbar)
  }

  return (
    <>
      <div
        className={`${
          isKeyboardOpen ? 'block' : 'hidden'
        } toolbars  w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative`}>
        <ToolbarMobile editor={editor} docMetadata={docMetadata} />
      </div>
      <div className="editor w-full h-full flex relative flex-row-reverse align-top ">
        <div className="editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4">
          <Editor editor={editor} />
        </div>
      </div>
      <div className="nd_modal hidden left w-full h-full fixed z-20 overflow-hidden">
        <TocModal docMetadata={docMetadata} editor={editor} />
      </div>
      <button
        onClick={toggleToolbar}
        className={`btn_bigBluePencil ${
          !isKeyboardOpen ? 'block active' : 'hidden'
        } w-14 h-14 z-10 outline-none fixed bottom-12 right-8 rounded-full drop-shadow-md flex align-middle items-center justify-center`}>
        <Pencil size={25} />
      </button>
    </>
  )
}

export default MobileEditor
