import Dexie from 'dexie'

// Define interfaces for the data structures
export interface TMeta {
  headingId: string
  docId?: string
  text?: string
  crinkleOpen: boolean
  level?: number
}

export interface TDocFilter {
  headingId: string
  docId?: string
  text?: string
  crinkleOpen: boolean
  level?: number
}

// Define the database structure
class MyDatabase extends Dexie {
  meta: Dexie.Table<TMeta, string> // Assuming 'headingId' is the primary key
  docFilter: Dexie.Table<TDocFilter, string> // Assuming 'headingId' is the primary key

  constructor(dbName: string) {
    super(dbName)
    this.version(2).stores({
      meta: 'headingId, *docId, text, crinkleOpen, level',
      docFilter: 'headingId, *docId, text, crinkleOpen, level'
    })

    // Define tables
    this.meta = this.table('meta')
    this.docFilter = this.table('docFilter')
  }
}

// Declare the database variable
export let db: MyDatabase

// Initialize the database
export const initDB = (dbName: string): MyDatabase => {
  const DexieDB = new MyDatabase(dbName)
  db = DexieDB
  return db
}
