import React, { useState, useEffect } from 'react'
import { useEditorStateContext } from '../../context/EditorContext'
import PadTitle from '../../components/TipTap/PadTitle'
import FilterModal from '../components/FilterModal'
import HeadSeo from '../../components/HeadSeo'
import TocModal from '../components/TocModal'
import Editor from './../components/Editor'
import { Pencil } from '../../components/icons/Icons'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import ToolbarMobile from './../components/ToolbarMobile'

const MobileLayout = ({ documentTitle, documentDescription, docSlug, docId, provider, editor }) => {
  const { isMobile, selectionPos, setSelectionPos, rendering, loading, deviceDetect } = useEditorStateContext()
  const [showToolbar, setShowToolbar] = useState(false)

  // check if keyboard is open
  const isKeyboardOpen = useDetectKeyboardOpen()

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

    editor?.on('focus', ({ editor, event }) => {
      // The editor is focused.
      // if (deviceDetect.is('iPhone')) {
      //   setSelectionPos(editor.state.selection.$anchor.pos)
      // }
    })

    editor?.on('selectionUpdate', ({ editor }) => {
      // The selection has changed.
      setSelectionPos(editor.state.selection.$anchor.pos)
    })

    // Make the editor read-only
    // editor.setEditable(false)
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
  }, [rendering, editor, deviceDetect, loading, setSelectionPos])

  return (
    <>
      <HeadSeo title={documentTitle} description="another open docs plus document" />
      <div className={`pad tiptap relative flex  flex-col border-solid ${isMobile ? 'm_mobile' : 'm_desktop'}`}>
        <div className="docTitle top-0 bg-white w-full min-h-14 p-2 flex flex-row items-center sm:border-b-0 border-b">
          {docSlug && (
            <PadTitle docSlug={docSlug} docId={docId} docTitle={documentTitle} provider={provider} editor={editor} />
          )}
        </div>
        <div
          className={`${
            isKeyboardOpen ? 'block' : 'hidden'
          } toolbars  w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative`}>
          {editor ? (
            <ToolbarMobile editor={editor} documentDescription={documentDescription} docId={docId} />
          ) : (
            'Loading...'
          )}
        </div>
        <div className="editor w-full h-full flex relative flex-row-reverse align-top ">
          <div className="editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4">
            {editor ? <Editor editor={editor} /> : 'Loading...'}
          </div>
        </div>
        <div className="nd_modal hidden left w-full h-full fixed z-20 overflow-hidden">
          <TocModal docId={docId} docTitle={documentTitle} editor={editor} />
        </div>
        <div className="nd_modal hidden bottom nd_filterModal w-full h-full fixed top-0 z-30 ">
          <FilterModal />
        </div>
        <button
          onClick={toggleToolbar}
          className={`btn_bigBluePencil ${
            !isKeyboardOpen ? 'block active' : 'hidden'
          } w-14 h-14 z-10 outline-none fixed bottom-12 right-8 rounded-full drop-shadow-md flex align-middle items-center justify-center`}>
          <Pencil size={25} />
        </button>
      </div>
    </>
  )
}

export default MobileLayout
