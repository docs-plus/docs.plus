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

const MobileLayout = ({ documentTitle, docSlug, docId, provider, editor }) => {
  const { isMobile, selectionPos, setSelectionPos } = useEditorStateContext()
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState('100%');

  // check if keyboard is open
  const isKeyboardOpen = useDetectKeyboardOpen();

  function toggleToolbar() {
    editor.commands.focus(selectionPos)
    setShowToolbar(!showToolbar);
  }

  editor?.on('focus', ({ editor, event }) => {
    // The editor is focused.
    setSelectionPos(editor.state.selection.$anchor.pos)
  })

  editor?.on('selectionUpdate', ({ editor }) => {
    // The selection has changed.
    setSelectionPos(editor.state.selection.$anchor.pos)
  })


  useEffect(() => {
    setShowToolbar(isKeyboardOpen);
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  }, [isKeyboardOpen])

  useEffect(() => {


    const viewportHandler = (event) => {
      event.preventDefault();
      // need these two lines, in order to prevent to change viewport in IOS
      document.body.scrollTop = 0;
      window.scrollTo({
        top: 0,
        left: 0,
      });

      const viewport = event.target;
      const isKeyboardOpen = viewport.height < window.innerHeight;
      // setShowToolbar(isKeyboardOpen);
      const viewportHeight = Math.trunc(viewport.height + viewport.pageTop);
      if (isKeyboardOpen) {
        const toolbar = document.querySelector('.toolbars')
        document.querySelector('.toolbars').style.top = `${ Math.trunc(viewport.height) - 36 }px`
      }

      const selection = window?.getSelection()?.anchorNode?.parentElement
      // document.querySelector('#root').style.height = `${ Math.trunc(viewport.height) }px`
      // const scrollTop = selection.offsetTop + 60 //.offsetTop - 38 - 40
      // console.log("viewportHandler log", {
      //   event,
      //   // viewport,
      //   isKeyboardOpen,
      //   viewportHeight: Math.trunc(viewport.height),
      //   viewportPageTop: viewport.pageTop,
      //   targetHight: viewportHeight,
      //   // selection: scrollTop,
      //   // robo: selection.offsetTop
      // })

      if (!selection) return
      // setTimeout(() => {
      if (event.type !== "scroll") {
        selection?.scrollIntoView({
          behavior: 'instant', block: 'start'
        })
      }


      // }, 4000)
      // document.querySelector('.editorWrapper').scrollTo({
      //   top: scrollTop,
      //   left: 0,
      // });

      // document.querySelector('.docTitle').style.top = `${ viewport.pageTop }px`

      // if (viewport.height - window.innerHeight )

      // if (viewport.height < window.innerHeight) {
      // console.log("keyboard open", isKeyboardOpen)
      // onKeyboardOnOff(true, viewport.height, viewport.pageTop);
      // scrollToFixViewPort(viewport);
      // } else {
      // console.log("keyboard closed", isKeyboardOpen)
      // onKeyboardOnOff(false, viewport.height, viewport.pageTop);
      // }
    };

    window.visualViewport.addEventListener('resize', viewportHandler);
    window.visualViewport.addEventListener('scroll', viewportHandler);


    // window.addEventListener('resize', handleResize);
    return () => {
      // window.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('resize', viewportHandler);
      window.visualViewport.removeEventListener('scroll', viewportHandler);
    };
  }, []);

  const toolbarStyle = {
    transform: `translateY(${ toolbarPosition })`
  };



  return (
    <>
      <HeadSeo title={documentTitle} description="another open docs plus document" />
      <div className={`pad tiptap flex flex-col border-solid ${ isMobile ? "m_mobile" : "m_desktop" }`}>
        <div className="docTitle bg-white w-full min-h-14 p-2 flex flex-row items-center sm:border-b-0 border-b">
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
