'use strict'
import 'rxjs/add/observable/from'
import 'rxjs/add/observable/of'
import 'rxjs/add/operator/switchMap'
import 'rxjs/add/operator/concatAll'
import 'rxjs/add/operator/concatMap'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { database$, schemaBuilder } from './lovefield'
import { forEach } from '../utils'

export interface SchemaPropertyDef {
  type: lf.Type
  primaryKey?: boolean
  index?: boolean
  unique?: string
  addNullable?: string
  // alias to other table
  virtual?: {
    name: string
    fields: string[]
  }
}

export interface SchemaDef {
  [index: string]: SchemaPropertyDef
}

export interface HookDef {
  store?: ((db: lf.Database, entity: any) => Promise<lf.Transaction>)[]
  destroy?: ((db: lf.Database, entity: any) => Promise<lf.Transaction>)[]
}

export class Database {
  database$ = database$

  private hooks = new Map<string, HookDef>()

  defineTable(tableName: string, schemaMetaData: SchemaDef) {
    let tableBuilder = schemaBuilder.createTable(tableName)
    const uniques: string[] = []
    const indexes: string[] = []
    const primaryKey: string[] = []
    const nullable: string[] = []
    forEach(schemaMetaData, (def, key) => {
      tableBuilder = tableBuilder.addColumn(key, def.type)
      if (def.primaryKey) {
        primaryKey.push(key)
      } else if (def.unique != null) {
        uniques.push(key)
      } else if (def.index) {
        indexes.push(key)
      } else {
        nullable.push(key)
      }
      if (def.virtual) {
        this.defineHook(tableName, {
          store: [
            (db: lf.Database, entity: any) => {
              return this.createStoreHook(db, key, def, entity)
            }
          ]
        })
      }
    })
    tableBuilder.addPrimaryKey(primaryKey)
      .addIndex('index', indexes)
      .addUnique('unique', uniques)
      .addNullable(nullable)
    return this
  }

  defineHook(tableName: string, hookDef: HookDef) {
    const hooks = this.hooks.get(tableName)
    if (hooks) {
      if (hookDef.store) {
        if (hooks.store) {
          hooks.store = hooks.store.concat(hookDef.store)
        } else {
          hooks.store = hookDef.store
        }
      }
      if (hookDef.destroy) {
        if (hooks.destroy) {
          hooks.destroy = hooks.destroy.concat(hookDef.destroy)
        } else {
          hooks.destroy = hookDef.destroy
        }
      }
    } else {
      this.hooks.set(tableName, hookDef)
    }
  }

  store<T>(tableName: string, data: T) {
    return this.database$
      .concatMap(db => {
        const table = db.getSchema().table(tableName)
        const row = table.createRow(data)
        const hooks = this.hooks.get(tableName)
        let hook: Observable<lf.Database> = Observable.of(null)
        if (hooks && hooks.store) {
           hook = <any>(Observable.from(
             hooks.store.map(fn => {
               return fn(db, data)
             })
          )
            .concatAll())
        }
        return hook.concatMap(() => {
          return db.insertOrReplace()
            .into(table)
            .values([row])
            .exec()
        })
      })
  }

  update<T>(tableName: string, primaryKey: string, patch: T) {
    return this.database$
      .switchMap(db => {
        const table: any = db.getSchema().table(tableName)
        let updateQuery = db.update(table)
        forEach(patch, (val, key) => {
          const col = table[key]
          if (typeof col === 'undefined') {
            console.warn(`patch key is not defined in table: ${key}`)
          } else {
            updateQuery = updateQuery.set(table[key], val)
          }
        })
        return updateQuery
          .where(table._id.eq(primaryKey))
          .exec()
      })
  }

  private createStoreHook(
    db: lf.Database,
    key: string,
    def: SchemaPropertyDef,
    entity: any
  ) {
    const tx = db.createTransaction()
    const virtualTable: any = db.getSchema().table(def.virtual.name)
    const query = db.select()
      .from(virtualTable)
      .where(virtualTable._id.eq(entity[key]))
    return tx.begin([virtualTable])
      .then(() => tx.attach(query))
      .then(result => {
        if (result.length) {
          let updateQuery = db.update(virtualTable)
            .where(virtualTable._id.eq(entity[key]))
          forEach(entity[key], (prop, propName) => {
            updateQuery = updateQuery.set(virtualTable[propName], prop)
          })
          return tx.attach(updateQuery)
        } else {
          const row = virtualTable.createRow(entity[key])
          const query = db.insert()
            .into(virtualTable)
            .values([row])
          return tx.attach(query)
        }
      })
      .then(() => tx.commit())
      .then(() => delete entity[key])
      .catch(() => tx.rollback())
      .then(() => tx)
  }
}

export default new Database
