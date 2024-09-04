const enums = {
  EVENTS: {
    FOLD_AND_UNFOLD: 'foldAndUnfold'
  },
  NODES: {
    DOC_TYPE: 'doc',
    HEADING_TYPE: 'heading',
    CONTENT_HEADING_TYPE: 'contentHeading',
    CONTENT_WRAPPER_TYPE: 'contentWrapper',
    PARAGRAPH_TYPE: 'paragraph',
    HYPERLINK_TYPE: 'hyperlink',
    TEXT_TYPE: 'text',
    BULLETLIST_TYPE: 'bulletList',
    ORDEREDLIST_TYPE: 'orderedList',
    LISTITEM_TYPE: 'listItem'
  },
  HTML_ENTITIES: {
    NBSP: '\u00A0', // Unicode for non-breaking space
    LT: '\u003C', // Unicode for less-than symbol
    GT: '\u003E', // Unicode for greater-than symbol
    AMP: '\u0026', // Unicode for ampersand
    QUOT: '\u0022', // Unicode for double quote
    APOSTROPHE: '\u0027' // Unicode for apostrophe
  }
}

export default enums
