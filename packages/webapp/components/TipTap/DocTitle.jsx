import { useEffect } from 'react'
import { useDocumentTitle } from '@context/DocumentTitleContext'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'

const DocTitle = ({ className, docMetadata }) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const { title, setTitle } = useDocumentTitle()

  useEffect(() => {
    setTitle(docMetadata.title)
  }, [])

  const documentTitle = docMetadata.title || title

  const saveData = (e) => {
    if (e.target.innerText === documentTitle) return

    mutate({
      title: e.target.innerText,
      documentId: docMetadata.documentId
    })
  }

  useEffect(() => {
    if (isSuccess && data) {
      setTitle(data.data.title)
      toast.success('Document title changed successfully')
    }
  }, [isSuccess])

  if (isLoading) return 'Loading...'

  return (
    <div className={`${className} `}>
      <div
        dangerouslySetInnerHTML={{ __html: title }}
        contentEditable
        className="border border-transparent px-2 py-0 rounded-sm text-lg font-medium w-full hover:border-slate-300 truncate"
        type="text"
        onBlur={saveData}
        onKeyDown={(e) => {
          if (event.key === 'Enter') {
            e.preventDefault()
            e.target.blur()
          }
        }}></div>
    </div>
  )
}

export default DocTitle
