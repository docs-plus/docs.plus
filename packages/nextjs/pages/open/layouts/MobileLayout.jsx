import PadTitle from '../../../components/TipTap/PadTitle'
import Toolbar from '../../../components/TipTap/Toolbar'
import FilterModal from './../components/FilterModal'
import HeadSeo from '../../../components/HeadSeo'
import TocModal from './../components/TocModal'
import Editor from './../components/Editor'

const MobileLayout = ({ documentTitle, docSlug, docId, provider, editor }) => {
  return (
    <>
      <HeadSeo title={documentTitle} description="another open docs plus document" />
      <div className="pad tiptap flex flex-col border-solid">
        <div className="docTitle w-full min-h-14 p-2 flex flex-row items-center sm:border-b-0 border-b">
          {docSlug && (
            <PadTitle
              docSlug={docSlug}
              docId={docId}
              docTitle={documentTitle}
              provider={provider}
            />
          )}
        </div>
        <div className="toolbars w-full bg-white h-auto z-10 sm:block fixed bottom-0 sm:relative">
          {editor ? <Toolbar editor={editor} /> : 'Loading...'}
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
      </div>
    </>
  );
}

export default MobileLayout;
