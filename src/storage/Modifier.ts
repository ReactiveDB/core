import { forEach } from '../utils'
import { PRIMARY_KEY_NOT_PROVIDED_ERR } from './RuntimeError'

export interface Inserter {
  preparedKeys: any[]
  insertQueries: lf.query.Insert[]
}

export class Modifier {

  private params: Object
  private meta: {
    key: string,
    val: any
  }

  constructor(
    private db: lf.Database,
    private table: lf.schema.Table,
    initialParams: Object = {}
  ) {
    this.params = {
      ...initialParams
    }
  }

  static concatToInserter(db: lf.Database, mods: Modifier[]): Inserter {
    const keys: any[] = []
    const queries: lf.query.Insert[] = []

    const map = new Map()
    for (let i = 0; i < mods.length; i++) {
      const curr = mods[i]
      const { table, row } = curr.toRow()
      const tableName = table.getName()
      const acc = map.get(tableName)

      keys.push(curr.refId())
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
        queries.push(query)
      })
    }

    return {
      preparedKeys: keys,
      insertQueries: queries
    }
  }

  toUpdater() {
    if (!this.meta) {
      throw PRIMARY_KEY_NOT_PROVIDED_ERR()
    }

    const query = this.db.update(this.table)
    query.where(this.table[this.meta.key].eq(this.meta.val))

    forEach(this.params, (val, key) => {
      query.set(this.table[key], val)
    })

    return query
  }

  toRow() {
    if (!this.meta) {
      throw PRIMARY_KEY_NOT_PROVIDED_ERR()
    }

    return {
      table: this.table,
      row: this.table.createRow({
        [this.meta.key]: this.meta.val,
        ...this.params
      })
    }
  }

  patch(patch: Object) {
    this.params = { ...this.params, ...patch }
    return this
  }

  assignPk(key: string, val: any) {
    this.meta = { key, val }
    return this
  }

  refId() {
    return this.meta ? this.meta.val : null
  }

}
