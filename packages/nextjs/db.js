import Dexie from 'dexie'

export let db

export const initDB = (dbName, t11) => {
  const DexieDB = new Dexie(dbName)

  const newdb = DexieDB.version(1).stores({
    meta: 'headingId, *docId, text, crinkleOpen, level'
  })

  db = newdb.db

  return db
}
