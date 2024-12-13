import DocumentSimpleLoader from '@components/skeleton/DocumentSimpleLoader'
import DocumentWithPictureLoader from '@components/skeleton/DocumentWithPictureLoader'
import TableOfcontentLoader from '@components/skeleton/TableOfContentsLoader'
import ToolbarSkeleton from '@components/skeleton/ToolbarLoader'
import { useStore } from '@stores'
import { PadTitleLoader } from './PadTitleLoader'

export const SlugPageLoader = ({
  loading = false,
  providerSyncing = false,
  loadingPage = false
}: {
  loading?: boolean
  providerSyncing?: boolean
  loadingPage?: boolean
}) => {
  const {
    settings: {
      editor: { isMobile }
    }
  } = useStore((state) => state)

  const deviceClass = isMobile ? 'm_mobile' : 'm_desktop'

  return (
    <div className={`pad tiptap flex flex-col border-solid ${deviceClass}`}>
      <div>
        <PadTitleLoader />
      </div>
      <div className="toolbars bottom-0 z-[9] hidden h-auto w-full bg-white sm:relative md:block">
        <ToolbarSkeleton />
      </div>
      <div className="editor relative flex size-full flex-row-reverse justify-around align-top">
        <div className="relative my-4 mt-2 flex w-full max-w-full flex-col align-top md:w-[78%]">
          <div className={'ProseMirror tiptap__editor m-auto pb-4 md:my-4'}>
            <DocumentSimpleLoader className="heading !h-auto" level="1" />
            <DocumentWithPictureLoader className="heading !h-auto" level="1" />
            <DocumentSimpleLoader className="heading !h-auto" level="1" />
          </div>
        </div>
        <div className="tableOfContents hidden h-full max-h-full w-[22%] md:block">
          <TableOfcontentLoader className="mt-6" />
        </div>
      </div>
      <div className="fixed bottom-4 left-4 flex w-fit items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 md:right-4">
        {loading && <span>Hang tight! Fetching profile data</span>}
        {!loading && providerSyncing && <span>Hang tight! Provider is syncing</span>}
        {!loading && !providerSyncing && loadingPage && <span>Hang tight! Loading Components</span>}
        <span className="loading loading-dots loading-xs ml-2 mt-2"></span>
      </div>
    </div>
  )
}
