import Toolbar from '@components/TipTap/toolbar/Toolbar'
import Editor from '../components/Editor'
import TOC from '../components/Toc'
import useEditorAndProvider from '@hooks/useEditorAndProvider'

const scrollHeadingSelection = (event) => {
  const scrollTop = event.currentTarget.scrollTop
  const toc = document.querySelector('.toc__list')
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

const DesktopEditor = ({ docMetadata }) => {
  const { editor, provider } = useEditorAndProvider({ docMetadata })

  return (
    <>
      <div className="toolbars w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative">
        {editor ? <Toolbar editor={editor} docMetadata={docMetadata} provider={provider} /> : 'Loading...'}
      </div>
      <div className="editor w-full h-full flex relative flex-row-reverse align-top ">
        <div
          className="editorWrapper w-9/12 grow flex items-start justify-center overflow-y-auto p-0 border-t-0 sm:py-4"
          onScroll={scrollHeadingSelection}>
          <Editor editor={editor} />
        </div>
        <div className="max-w-xs w-3/12 overflow-hidden pb-4 sm:py-4 sm:pb-14 scroll-smooth hover:overflow-auto hover:overscroll-contain">
          <TOC editor={editor} />
        </div>
      </div>
    </>
  )
}

export default DesktopEditor
