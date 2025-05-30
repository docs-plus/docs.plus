import TOCDesktop from '@components/TipTap/tableOfContents/TocDesktop'
import TableOfcontentLoader from '@components/skeleton/TableOfContentsLoader'
import { useStore } from '@stores'

const TOC = ({ className = '' }: any) => {
  const {
    editor: { loading, applyingFilters, providerSyncing, instance: editor }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || providerSyncing) {
    return (
      <div>
        <TableOfcontentLoader className="mt-6" />
      </div>
    )
  }

  return (
    <TOCDesktop
      className={`${className} tiptap__toc h-full w-full overflow-hidden overflow-y-auto scroll-smooth pr-10 pb-4 hover:overscroll-contain sm:py-4 sm:pb-14`}
    />
  )
}

export default TOC
