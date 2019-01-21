import { Database, DataStoreType, enableRefTracing } from 'reactivedb'

import { TodoSchema } from './schema'

enableRefTracing(2, 'id')

const database = new Database(DataStoreType.MEMORY, true, 'todomvc', 1)
database.defineSchema('Todo', TodoSchema)
database.connect()

let uid = 0
export const nextUid = () => uid++

export { database }
