import React, { useState, useEffect } from 'react'
import { useEditorStateContext } from '../../../context/EditorContext'
import PadTitle from '../../../components/TipTap/PadTitle'
import Toolbar from '../../../components/TipTap/Toolbar'
import FilterModal from './../components/FilterModal'
import HeadSeo from '../../../components/HeadSeo'
import TocModal from './../components/TocModal'
import Editor from './../components/Editor'
import { Pencil } from '../../../components/icons/Icons'
import useDetectKeyboardOpen from "use-detect-keyboard-open";

import MobileDetect from 'mobile-detect'

const MobileLayout = ({ documentTitle, docSlug, docId, provider, editor }) => {
  const { isMobile, selectionPos, setSelectionPos, rendering, loading } = useEditorStateContext()
  const [showToolbar, setShowToolbar] = useState(false);


  // check if keyboard is open
  const isKeyboardOpen = useDetectKeyboardOpen();

  function toggleToolbar() {
    if (!isKeyboardOpen) {
      editor?.setEditable(true)
    }
    editor.commands.focus(selectionPos === 0 ? 'start' : selectionPos)
    setShowToolbar(!showToolbar);

  }

  editor?.on('focus', ({ editor, event }) => {
    // The editor is focused.
    // setSelectionPos(editor.state.selection.$anchor.pos)
  })

  editor?.on('selectionUpdate', ({ editor }) => {
    // The selection has changed.
    setSelectionPos(editor.state.selection.$anchor.pos)
  })

  useEffect(() => {
    setShowToolbar(isKeyboardOpen);

    if (isKeyboardOpen) {
      console.log("keyboard is open")
      // editor?.setEditable(true)
    } else {
      // Make the editor read-only
      editor?.setEditable(false)
      console.log("keyboard is closed")

    }
  }, [isKeyboardOpen])

  useEffect(() => {
    if (!editor || loading) return

    const deviceDetect = new MobileDetect(navigator.userAgent);
    document.querySelector("html").classList.add('m_mobile')

    // Make the editor read-only
    editor.setEditable(false)

    const viewportHandler = (event) => {
      event.preventDefault();
      // need these two lines, in order to prevent to change viewport in IOS
      window.scrollTo({ top: 0 });
      document.body.scrollTop = 0;


      const viewport = event.target;
      const viewportHeight = Math.trunc(viewport.height - viewport.pageTop);

      // setShowToolbar(isKeyboardOpen);
      document.body.style.height = `${ viewportHeight }px`
      document.querySelector('html').style.height = `${ viewportHeight }px`

      document.querySelector('.toolbars').style.top = `${ Math.trunc(viewport.height) - 36 }px`

      console.log("type:<=", event.type, "=>", {
        viewportHeight,
        viewport,
        event,
        // w, h,
        isKeyboardOpen
      })


      const selection = window?.getSelection()?.anchorNode?.parentElement

      if (!selection) return

      if (deviceDetect.is('iPhone')) {
        if (event.type !== "scroll") {
          selection?.scrollIntoView({
            behavior: 'instant', block: 'start'
          })
        }
      } else {
        if (event.type !== "resize") {
          selection?.scrollIntoView({
            behavior: 'instant', block: 'start'
          })
        }
      }

    }





    window.visualViewport.addEventListener('resize', viewportHandler);
    window.visualViewport.addEventListener('scroll', viewportHandler);


    return () => {
      window.visualViewport.removeEventListener('resize', viewportHandler);
      window.visualViewport.removeEventListener('scroll', viewportHandler);
    };
  }, [rendering, editor])





  return (
    <>
      <HeadSeo title={documentTitle} description="another open docs plus document" />
      <div className={`pad tiptap relative flex  flex-col border-solid ${ isMobile ? "m_mobile" : "m_desktop" }`}>
        <div className="docTitle  z-50 top-0 bg-white w-full min-h-14 p-2 flex flex-row items-center sm:border-b-0 border-b">
          {docSlug && (
            <PadTitle
              docSlug={docSlug}
              docId={docId}
              docTitle={documentTitle}
              provider={provider}
            />
          )}
        </div>
        <div className={`toolbars ${ isKeyboardOpen ? 'block' : 'hidden' }  w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative`}>
          {editor ? <Toolbar editor={editor} /> : 'Loading...'}
          {/* <div className='w-full h-11 p-4 bg-slate-600 '></div> */}
        </div>
        <div className="editor w-full h-full flex relative flex-row-reverse align-top ">
          <div
            className="editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4"
          >
            <Editor editor={editor} />
          </div>
        </div>
        <div className='nd_modal hidden left w-full h-full fixed z-20 overflow-hidden'>
          <TocModal docId={docId} docTitle={documentTitle} editor={editor} />
        </div>
        <div className='nd_modal hidden bottom nd_filterModal w-full h-full fixed top-0 z-30 '>
          <FilterModal />
        </div>
        <button onClick={toggleToolbar} className={`${ !isKeyboardOpen ? 'block' : 'hidden' } w-14 h-14 z-50 outline-none fixed bottom-12 right-12 rounded-full drop-shadow-md bg-blue-600 flex align-middle items-center justify-center`}>
          <Pencil />
        </button>
      </div>
    </>
  );
}

export default MobileLayout;
