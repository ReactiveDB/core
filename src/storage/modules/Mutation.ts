import * as lf from 'lovefield'

import { forEach, assertValue, warn } from '../../utils'
import { fieldIdentifier } from '../symbols'
import * as Exception from '../../exception'

export class Mutation {

  private params: Object
  private meta: {
    key: string,
    val: any
  } | undefined

  constructor(
    private db: lf.Database,
    private table: lf.schema.Table,
    initialParams: Object = {}
  ) {
    this.params = {
      ...initialParams
    }
  }

  static aggregate(db: lf.Database, insert: Mutation[], update: Mutation[]): {
    contextIds: any[]
    queries: lf.query.Insert[]
  } {
    const keys: any[] = []
    const insertQueries: lf.query.Insert[] = []

    const map = new Map()
    for (let i = 0; i < insert.length; i++) {
      const curr = insert[i]
      const { table, row } = curr.toRow()
      const tableName = table.getName()
      const acc = map.get(tableName)

      keys.push(fieldIdentifier(tableName, curr.refId()))

      if (acc) {
        acc.push(row)
      } else {
        map.set(tableName, [row])
      }
    }

    if (map.size) {
      map.forEach((rows: lf.Row[], name) => {
        const target = db.getSchema().table(name)
        const query = db.insertOrReplace().into(target).values(rows)
        insertQueries.push(query)
      })
    }

    const updateQueries: lf.query.Update[] = []
    for (let i = 0; i < update.length; i++) {
      if (Object.keys(update[i].params).length > 0) {
        updateQueries.push(update[i].toUpdater())
      }
    }

    return {
      contextIds: keys,
      queries: insertQueries.concat(updateQueries as any[])
    }
  }

  private toUpdater() {
    const meta = assertValue(this.meta, Exception.PrimaryKeyNotProvided)
    const query = this.db.update(this.table)
    query.where(this.table[meta.key].eq(meta.val))

    forEach(this.params, (val, key) => {
      const column = this.table[key]
      if (column) {
        query.set(column, val)
      } else {
        warn(`Column: ${key} is not existent on table:${this.table.getName()}`)
      }
    })

    return query
  }

  private toRow() {
    const meta = assertValue(this.meta, Exception.PrimaryKeyNotProvided)
    return {
      table: this.table,
      row: this.table.createRow({
        [meta.key]: meta.val,
        ...this.params
      })
    }
  }

  patch(patch: Object) {
    this.params = { ...this.params, ...patch }
    return this
  }

  withId(key: string, val: any) {
    this.meta = { key, val }
    return this
  }

  refId() {
    return this.meta ? this.meta.val : null
  }

}
