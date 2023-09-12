import { useEffect, useState } from 'react'
import useDetectKeyboardOpen from 'use-detect-keyboard-open'
import Toolbar from '@components/TipTap/toolbar/Toolbar'
import { useEditorStateContext } from '@context/EditorContext'
import useEditorAndProvider from '@hooks/useEditorAndProvider'
import EditorContent from '../components/EditorContent'
import { Pencil } from '@icons'
import TOC from '../components/Toc'
import ToolbarMobile from './ToolbarMobile'
import TocModal from '../components/TocModal'

const scrollHeadingSelection = (event) => {
  const scrollTop = event.currentTarget.scrollTop
  const toc = document.querySelector('.toc__list')
  if (!toc) return
  const tocLis = [...toc.querySelectorAll('.toc__item')]
  const closest = tocLis
    .map((li) => {
      li.classList.remove('active')
      return li
    })
    .filter((li) => {
      const thisOffsetTop = +li.getAttribute('data-offsettop') - 220
      return thisOffsetTop <= scrollTop // && nextSiblingOffsetTop >= scrollTop
    })
  closest.at(-1)?.classList.add('active')
  closest.at(-1)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest'
  })
}

const Editor = ({ docMetadata }) => {
  const { editor, provider } = useEditorAndProvider({ docMetadata })
  // Mobile specific code
  const { loading, deviceDetect, selectionPos, setSelectionPos, isMobile } = useEditorStateContext()
  const [showToolbar, setShowToolbar] = useState(false)
  const isKeyboardOpen = useDetectKeyboardOpen()

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
    document.querySelector('html').classList.add(isMobile ? 'm_mobile' : 'm_desktop')
    if (isMobile) {
      // I did in this way, in order to have much control on the editor on the Mobile
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
    }
  }, [isMobile])

  function toggleToolbar() {
    if (!isMobile) return
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
      <div className="toolbars w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative">
        {!isMobile ? (
          editor ? (
            <Toolbar editor={editor} docMetadata={docMetadata} provider={provider} />
          ) : (
            'Loading...'
          )
        ) : (
          isKeyboardOpen && <ToolbarMobile editor={editor} docMetadata={docMetadata} />
        )}
      </div>
      <div className="editor w-full h-full flex relative flex-row-reverse align-top ">
        <div
          className="editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4"
          onScroll={!isMobile ? scrollHeadingSelection : undefined}>
          <EditorContent editor={editor} />
        </div>
        {!isMobile && (
          <div className="tableOfContents max-w-xs w-3/12 overflow-hidden pb-4 sm:py-4 sm:pb-14 pr-16 scroll-smooth hover:overflow-auto hover:overscroll-contain">
            <TOC editor={editor} />
          </div>
        )}
      </div>
      {isMobile && (
        <>
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
      )}
    </>
  )
}

export default Editor
