import TableOfContents from '../../../components/TipTap/TableOfContents'
import TableOfcontentLoader from '../../../components/TableOfContentsLoader'
import { useEditorStateContext } from '../../../context/EditorContext'

const TOC = ({ className = '', editor }) => {
  const { loading, applyingFilters } = useEditorStateContext()

  if (loading || !editor) {
    return (
      <div>
        <TableOfcontentLoader className="mt-6" />
      </div>
    )
  }

  return (
    <TableOfContents
      className={`${className} tiptap__toc pl-2`}
      editor={editor}
    />
  )
}

export default TOC
