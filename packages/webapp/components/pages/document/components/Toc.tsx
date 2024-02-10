import TableOfContents from '@components/TipTap/tableOfContents'
import TableOfcontentLoader from '@components/TableOfContentsLoader'
import { useStore } from '@stores'

const TOC = ({ className = '' }: any) => {
  const {
    editor: { loading, applyingFilters, rendering, instance: editor }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || rendering) {
    return (
      <div>
        <TableOfcontentLoader className="mt-6" />
      </div>
    )
  }

  return <TableOfContents className={`${className} tiptap__toc `} />
}

export default TOC
