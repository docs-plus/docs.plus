import { useEffect, useState } from 'react'
import useUpdateDocMetadata from '../../hooks/useUpdateDocMetadata'
import toast from 'react-hot-toast'

const DocTitle = ({ className, docMetadata }) => {
  const { isLoading, isSuccess, mutate, data } = useUpdateDocMetadata()
  const { title, documentId } = docMetadata

  const [documentTitle, setDocumentTitle] = useState(title)

  const saveData = (e) => {
    if (e.target.innerText === title) return
    mutate({
      title: e.target.innerText,
      documentId
    })
  }

  useEffect(() => {
    if (isSuccess) {
      toast.success('Document title change successfully')
    }
    if (isSuccess && data) {
      setDocumentTitle(data.data.title)
    }
  }, [isSuccess, data])

  if (isLoading) return 'Loading...'

  return (
    <div className={`${className} `}>
      <div
        dangerouslySetInnerHTML={{ __html: documentTitle }}
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
