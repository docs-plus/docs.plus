/**
 * Test fixtures for documents
 */

export const validDocument = {
  title: 'Test Document',
  slug: 'test-document',
  description: 'A test document for testing',
  keywords: ['test', 'document', 'example']
}

export const invalidDocument = {
  // Missing required fields
  description: 'Invalid document'
}

export const documentUpdate = {
  title: 'Updated Title',
  description: 'Updated description',
  keywords: ['updated', 'test'],
  readOnly: false
}

export const mockDocumentMetadata = {
  id: 1,
  slug: 'test-document',
  title: 'Test Document',
  description: 'A test document',
  keywords: 'test,document',
  documentId: 'abc123xyz456',
  ownerId: 'user-123',
  email: 'test@example.com',
  isPrivate: false,
  readOnly: false,
  createdAt: new Date(),
  updatedAt: new Date()
}

export const mockDocumentsList = [
  {
    id: 1,
    slug: 'doc-1',
    title: 'Document 1',
    description: 'First test document',
    keywords: 'test,one',
    documentId: 'doc1-id',
    ownerId: 'user-123',
    readOnly: false,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    slug: 'doc-2',
    title: 'Document 2',
    description: 'Second test document',
    keywords: 'test,two',
    documentId: 'doc2-id',
    ownerId: 'user-456',
    readOnly: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
]

export const createTestFile = (
  name: string = 'test.jpg',
  type: string = 'image/jpeg',
  size: number = 1024
): File => {
  const buffer = new Uint8Array(size)
  for (let i = 0; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256)
  }
  return new File([buffer], name, { type })
}
