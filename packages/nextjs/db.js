import Dexie from 'dexie'

export let db

export const initDB = (dbName) => {
  const DexieDB = new Dexie(dbName)

  const newdb = DexieDB.version(2).stores({
    meta: 'headingId, *docId, text, crinkleOpen, level',
    docFilter: 'headingId, *docId, text, crinkleOpen, level'
  })

  db = newdb.db

  return db
}
