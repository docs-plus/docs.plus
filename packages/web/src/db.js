import Dexie from 'dexie'

export const db = new Dexie('document')

db.version(1).stores({
  documents: 'headingId, *docId, text, crinkleOpen, level'
})
