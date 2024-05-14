import TableOfContents from '@components/TipTap/tableOfContents'
import TableOfcontentLoader from '@components/TableOfContentsLoader'
import { useStore } from '@stores'

import { useTypingIndicator } from '@components/chat/hooks/useTypingIndicator'

const TOC = ({ className = '' }: any) => {
  const {
    editor: { loading, applyingFilters, rendering, instance: editor }
  } = useStore((state) => state.settings)

  useTypingIndicator()

  if (loading || !editor || applyingFilters || rendering) {
    return (
      <div>
        <TableOfcontentLoader className="mt-6" />
      </div>
    )
  }

  return (
    <TableOfContents
      className={`${className} tiptap__toc pb-4 sm:py-4 h-full sm:pb-14 pr-10 scroll-smooth overflow-hidden overflow-y-auto hover:overscroll-contain !max-w-[19rem]`}
    />
  )
}

export default TOC
