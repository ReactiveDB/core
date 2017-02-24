import { Database, DataStoreType } from 'reactivedb'

export default new Database(DataStoreType.INDEXED_DB, true, 'ReactiveDB', 1)
