import * as lf from 'lovefield'
import { Database } from '../../src/storage/Database'

export const database = new Database(lf.schema.DataStoreType.INDEXED_DB, true)
