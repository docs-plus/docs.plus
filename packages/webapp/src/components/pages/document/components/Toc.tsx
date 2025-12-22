import { TocDesktop } from '@components/toc'
import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import { useStore } from '@stores'

const TOC = ({ className = '' }: { className?: string }) => {
  const {
    editor: { loading, applyingFilters, providerSyncing, instance: editor }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || providerSyncing) {
    return (
      <div>
        <TableOfContentsLoader className="mt-6" />
      </div>
    )
  }

  return (
    <TocDesktop
      className={`${className} tiptap__toc h-full w-full overflow-hidden overflow-y-auto scroll-smooth hover:overscroll-contain`}
    />
  )
}

export default TOC
