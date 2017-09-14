import { forEach } from '../../utils'
import { TableStruct } from '../../interface'

export function pad(db: lf.Database, tables: Map<string, string>, struct: TableStruct) {
  forEach(struct, inner => {
    const tableName = inner.table.getName()
    tables.delete(tableName)
  })

  forEach(tables, (key, tableName) => {
    const table = db.getSchema().table(tableName)
    struct[key] = { table, contextName: tableName }
  })

  return struct
}

export function build(table: lf.schema.Table, alias?: string, struct: TableStruct = {}) {
  if (alias) {
    struct[alias] = {
      table: table,
      contextName: alias
    }
  } else {
    const tableName = table.getName()
    struct[tableName] = {
      table: table,
      contextName: tableName
    }
  }

  return struct
}
