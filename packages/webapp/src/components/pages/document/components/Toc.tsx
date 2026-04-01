import TableOfContentsLoader from '@components/skeleton/TableOfContentsLoader'
import { TocDesktop } from '@components/toc'
import { ScrollArea } from '@components/ui/ScrollArea'
import { useStore } from '@stores'

const TOC = ({ className = '' }: { className?: string }) => {
  const loading = useStore((state) => state.settings.editor.loading)
  const applyingFilters = useStore((state) => state.settings.editor.applyingFilters)
  const providerSyncing = useStore((state) => state.settings.editor.providerSyncing)
  const editor = useStore((state) => state.settings.editor.instance)

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
      scrollbarSize="thin">
      <TocDesktop className="hover:overscroll-contain" />
    </ScrollArea>
  )
}

export default TOC
