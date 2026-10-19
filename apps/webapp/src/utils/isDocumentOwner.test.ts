import { selectDocumentEditingLocked } from '@hooks/isDocumentEditingLocked'
import type { Workspace } from '@stores'

import { canEditDocumentMetadata, isDocumentOwner } from './isDocumentOwner'

const ME = 'user-me'
const OTHER = 'user-other'

const lockFor = (metadata: Workspace['metadata'], profileId?: string) =>
  selectDocumentEditingLocked(
    { metadata, providerStatus: 'saved', authorizedScope: null } as Workspace,
    profileId
  )

describe('pre-sync: the store seeds metadata without a documentId', () => {
  // A yes here flashed an editable title or owner controls on a pad the reader cannot change.
  it('answers no owner and no retitle, even when ownerId matches', () => {
    expect(isDocumentOwner({ ownerId: ME }, ME)).toBe(false)
    expect(canEditDocumentMetadata({}, ME)).toBe(false)
    expect(canEditDocumentMetadata({ ownerId: null }, undefined)).toBe(false)
  })
})

describe('after documentId lands', () => {
  it('lets anyone retitle an open document, and treats an empty ownerId as open', () => {
    for (const ownerId of [null, undefined, '']) {
      expect(canEditDocumentMetadata({ documentId: 'd', ownerId }, undefined)).toBe(true)
      expect(isDocumentOwner({ documentId: 'd', ownerId }, ME)).toBe(false)
    }
  })

  it('keeps an owned document to its owner', () => {
    expect(isDocumentOwner({ documentId: 'd', ownerId: ME }, ME)).toBe(true)
    expect(canEditDocumentMetadata({ documentId: 'd', ownerId: ME }, ME)).toBe(true)
    expect(isDocumentOwner({ documentId: 'd', ownerId: ME }, OTHER)).toBe(false)
    expect(canEditDocumentMetadata({ documentId: 'd', ownerId: ME }, OTHER)).toBe(false)
    expect(canEditDocumentMetadata({ documentId: 'd', ownerId: ME }, undefined)).toBe(false)
  })
})

describe('Read-only editing lock', () => {
  it('locks a non-owner and a visitor, never the owner', () => {
    const meta = { documentId: 'd', ownerId: ME, readOnly: true }
    expect(lockFor(meta, ME)).toBe(false)
    expect(lockFor(meta, OTHER)).toBe(true)
    expect(lockFor(meta, undefined)).toBe(true)
  })

  it('does not lock an ownerless pad', () => {
    expect(lockFor({ documentId: 'd', ownerId: null, readOnly: true }, ME)).toBe(false)
  })
})
