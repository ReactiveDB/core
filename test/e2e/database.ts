import { DataStoreType } from '../../src/interface'
import { Database } from '../../src/storage/Database'

export const database = new Database(DataStoreType.INDEXED_DB, true)
