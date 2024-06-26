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
      className={`${className} tiptap__toc h-full !max-w-[19rem] overflow-hidden overflow-y-auto scroll-smooth pb-4 pr-10 hover:overscroll-contain sm:py-4 sm:pb-14`}
    />
  )
}

export default TOC
