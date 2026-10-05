import Select from '@components/ui/Select'
import { useId } from 'react'

import type { DocumentsScope } from '../constants'
import { useDocumentsListPrefs } from '../hooks/useDocumentsListPrefs'
import type { DocumentSortKey } from '../types'

/**
 * The Show and sort pickers for a documents list, in Settings and on Home. Each is named by
 * a hidden `<label>`, because `Select` takes no `aria-label`.
 */
function DocumentsListSelects() {
  const { listScope, sortKey, scopeOptions, sortOptions, setListScope, setSortKey } =
    useDocumentsListPrefs()
  const scopeLabelId = useId()
  const sortLabelId = useId()

  // `Select` hands back a plain string, and it only offers the values passed in.
  return (
    <>
      <label htmlFor={scopeLabelId} className="sr-only">
        Show
      </label>
      <Select
        id={scopeLabelId}
        size="sm"
        value={listScope}
        onChange={(value) => setListScope(value as DocumentsScope)}
        options={scopeOptions}
        wrapperClassName="min-w-0 flex-1 sm:max-w-40"
        className="min-h-11 sm:min-h-8"
      />
      <label htmlFor={sortLabelId} className="sr-only">
        Sort documents
      </label>
      <Select
        id={sortLabelId}
        size="sm"
        value={sortKey}
        onChange={(value) => setSortKey(value as DocumentSortKey)}
        options={sortOptions}
        wrapperClassName="min-w-0 flex-1 sm:max-w-44"
        className="min-h-11 sm:min-h-8"
      />
    </>
  )
}

export default DocumentsListSelects
