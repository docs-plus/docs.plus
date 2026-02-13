import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import { TocDesktop } from '@components/toc'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'

const TOC = ({ className = '' }: { className?: string }) => {
  const {
    editor: { loading, applyingFilters, providerSyncing, instance: editor }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || providerSyncing) {
    return (
      <div className="p-4">
        <TableOfContentsLoader className="mt-2" />
      </div>
    )
  }

  return (
    <ScrollArea
      className={`${className} tiptap__toc h-full w-full !pt-0`}
      orientation="vertical"
      scrollbarSize="thin"
      hideScrollbar>
      <TocDesktop className="hover:overscroll-contain" />
    </ScrollArea>
  )
}

export default TOC
