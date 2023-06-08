export const CREATE_DOCUMENT = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'Create New DOCUMENT',
  required: ['slug'],
  additionalProperties: true,
  properties: {
    slug: {
      type: 'string',
      title: 'Document slug',
      minLength: 2
    },
    description: {
      type: 'string',
      title: 'The document description'
    },
    keywords: {
      type: 'array',
      title: 'The document keywords',
      items: {
        type: 'string'
      }
    },
    title: {
      type: 'string',
      title: 'The document title'
    }
  }
}

export const UPDATE_DOCUMENT_METADATA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  title: 'Update Document Metadata',
  additionalProperties: true,
  properties: {
    description: {
      type: 'string',
      title: 'The document description',
      minLength: 4
    },
    keywords: {
      type: 'array',
      title: 'The document keywords',
      items: {
        type: 'string'
      }
    },
    title: {
      type: 'string',
      title: 'The document title',
      minLength: 4
    }
  }
}
