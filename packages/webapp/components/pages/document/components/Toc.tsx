import TableOfContents from '@components/TipTap/TableOfContents'
import TableOfcontentLoader from '@components/TableOfContentsLoader'
import { useStore } from '@stores'

const TOC = ({ className = '', editor }: any) => {
  const {
    editor: { loading, applyingFilters, rendering }
  } = useStore((state) => state.settings)

  if (loading || !editor || applyingFilters || rendering) {
    return (
      <div>
        <TableOfcontentLoader className="mt-6" />
      </div>
    )
  }

  return <TableOfContents className={`${className} tiptap__toc `} editor={editor} />
}

export default TOC
