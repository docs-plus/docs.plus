import { useStore } from '@stores'

import RenameDocumentDialog from './components/RenameDocumentDialog'
import type { DocumentsListScope } from './documentsQueryKey'
import type { OwnedDocument } from './types'

/** Opens the rename dialog for a grid tile, or for a Home list row below `sm`. */
export function openRenameDocumentDialog(doc: OwnedDocument, scope: DocumentsListScope): void {
  useStore
    .getState()
    .openDialog(
      <RenameDocumentDialog documentId={doc.documentId} currentTitle={doc.title} scope={scope} />,
      { size: 'md', align: 'top', className: 'mt-14' }
    )
}
