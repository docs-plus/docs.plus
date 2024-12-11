import TOCDesktop from '@components/TipTap/tableOfContents/TocDesktop'
import TableOfcontentLoader from '@components/skeleton/TableOfContentsLoader'
import { useStore } from '@stores'

import { useTypingIndicator } from '@components/chat/hooks/useTypingIndicator'

const TOC = ({ className = '' }: any) => {
  const {
    editor: { loading, applyingFilters, providerSyncing, instance: editor }
  } = useStore((state) => state.settings)

  useTypingIndicator()

  if (loading || !editor || applyingFilters || providerSyncing) {
    return (
      <div>
        <TableOfcontentLoader className="mt-6" />
      </div>
    )
  }

  return (
    <TOCDesktop
      className={`${className} tiptap__toc h-full !max-w-[19rem] overflow-hidden overflow-y-auto scroll-smooth pb-4 pr-10 hover:overscroll-contain sm:py-4 sm:pb-14`}
    />
  )
}

export default TOC
