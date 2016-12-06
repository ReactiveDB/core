'use strict'
import 'rxjs/add/observable/from'
import 'rxjs/add/observable/fromPromise'
import 'rxjs/add/observable/of'
import 'rxjs/add/observable/empty'
import 'rxjs/add/observable/throw'
import 'rxjs/add/operator/switchMap'
import 'rxjs/add/operator/concatMap'
import 'rxjs/add/operator/mergeMap'
import 'rxjs/add/operator/concatAll'
import 'rxjs/add/operator/catch'
import 'rxjs/add/operator/skip'
import 'rxjs/add/operator/do'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/mapTo'
import 'rxjs/add/operator/toPromise'
import 'rxjs/add/operator/toArray'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { lfFactory } from './lovefield'
import { RDBType } from './DataType'
import { SelectMeta } from './SelectMeta'
import { QueryToken } from './QueryToken'
import { forEach, flat } from '../utils'

export interface SchemaMetadata {
  type: RDBType
  primaryKey?: boolean
  index?: boolean
  unique?: string
  /**
   * alias to other table
   * 这里需要定义表名，字段和查询条件
   */
  virtual?: {
    name: string
    fields: string[]
    where<T> (table: lf.schema.Table, data: T): lf.Predicate
  }
  // 被 Database.prototype.createRow 动态挂上去的
  // readonly isHidden?: boolean
  // readonly hiddenMapper?: (val: any) => any
}

export interface SchemaDef {
  [index: string]: SchemaMetadata
}

export interface HookDef {
  insert?: (db: lf.Database, entity: any) => Promise<any>
  destroy?: (db: lf.Database, entity: any) => lf.query.Builder
}

export interface HooksDef {
  insert: ((db: lf.Database, entity: any) => Promise<any>)[]
  destroy: ((db: lf.Database, entity: any) => lf.query.Builder)[]
}

/**
 * 在查询和更新数据的时候需要使用的元数据
 * 每次查询会遍历 VirtualMetadata，然后将需要使用的字段从对应的 VirtualTable 中查到，拼接到对应的字段上
 * 更新的时候也会查询是否更新的是 Virtual 字段，如果更新的是 Virtual 字段，则忽略这次更新
 */
export interface VirtualMetadata {
  // table name
  name: string
  fields: Set<string>
  resultType?: 'Collection' | 'Model'
  where(table: lf.schema.Table, targetTable: lf.schema.Table): lf.Predicate
}

export interface SelectMetadata {
  fields: Set<string>
  virtualMeta: Map<string, VirtualMetadata>
  mapper: Map<string, Function>
}

export interface GetQuery {
  fields?: string[]
  primaryValue?: string
  where? (table: lf.schema.Table): lf.Predicate
}

export interface VirtualTableMetadataDescription {
  key: string
  resultType: 'Model' | 'Collection'
}

export interface LeftJoinMetadata { table: lf.schema.Table, predicate: lf.Predicate }

export class Database {
  private static hooks = new Map<string, HooksDef>()
  private static schemaMetaData = new Map<string, SchemaDef>()
  /**
   * hidden row namespace
   * 比如 api 获取的 task.created 是 string 类型
   * 我们希望它存储为 number 类型（方便我们 Select 的时候对它进行一系列的条件运算
   * 那么可以在 Schema 上将它定义为:
   * RDBType.DATA_TIME
   * 然后 Database 类会将原始值存储到 __hidden__created 字段上
   * 存储的时候将原始值存储为 new Date(task.created)
   */
  private static readonly hn = '__hidden__'

  database$: Observable<lf.Database>
  schemaBuilder: lf.schema.Builder

  private primaryKeysMap = new Map<string, string>()
  private selectMetaData = new Map<string, SelectMetadata>()
  private virtualTableMetadataDescription = new Map<string, Map<string, VirtualTableMetadataDescription>>()

  /**
   * 定义数据表的 metadata
   * 会根据这些 metadata 决定增删改查的时候如何处理关联数据
   */
  static defineSchema(tableName: string, schemaMetaData: SchemaDef) {
    if (!Database.schemaMetaData) {
      throw new TypeError(`Can not defineSchema after Database initialized`)
    }
    if (Database.schemaMetaData.has(tableName)) {
      throw new TypeError(`Can not redefine table: ${tableName}`)
    }
    let hasPrimaryKey = false
    forEach(schemaMetaData, meta => {
      if (meta.primaryKey) {
        hasPrimaryKey = true
        return false
      }
      return true
    })
    if (!hasPrimaryKey) {
      throw new TypeError(`No primaryKey key give in schemaMetaData: ${JSON.stringify(schemaMetaData, null, 2)}`)
    }
    Database.schemaMetaData.set(tableName, schemaMetaData)
    Database.hooks.set(tableName, {
      insert: [],
      destroy: []
    })
  }

  /**
   * 在数据表上定义一些 hook
   * 这些 hook 的过程都是 transaction 组成
   */
  static defineHook(tableName: string, hookDef: HookDef) {
    const hooks = Database.hooks.get(tableName)
    if (hooks) {
      if (hookDef.insert) {
        hooks.insert.push(hookDef.insert)
      }
      if (hookDef.destroy) {
        hooks.destroy.push(hookDef.destroy)
      }
      return hookDef
    } else {
      throw new TypeError(`you should defineSchema before you defineHook: ${tableName}`)
    }
  }

  constructor(
    storeType: lf.schema.DataStoreType = lf.schema.DataStoreType.MEMORY,
    enableInspector: boolean = false,
    // database name
    name = 'teambition',
    // database version
    version = 1
  ) {
    this.schemaBuilder = lf.schema.create(name, version)
    this.database$ = lfFactory(this.schemaBuilder, { storeType, enableInspector })
    this.buildTables()
  }

  insert<T>(tableName: string, data: T[]): Observable<T[]>

  insert<T>(tableName: string, data: T): Observable<T>

  insert<T>(tableName: string, data: T | T[]): Observable<T> | Observable<T[]>

  /**
   * 存储数据到数据表
   * 先执行 insert hook 列表中的 hook 再存储
   * insertHooks 是一些 lovefield query
   * 它们将在一个 transaction 中被串行执行，任意一个失败回滚所有操作并抛出异常
   */
  insert<T>(tableName: string, data: T | T[]): Observable<T> | Observable<T[]> {
    return this.database$
      .concatMap(db => {
        const table = db.getSchema().table(tableName)
        let hook: Observable<any> = Observable.of(null)
        const rows: lf.Row[] = []
        if (data instanceof Array) {
          const hookObservables: Observable<lf.Transaction>[] = []
          data.forEach(r => {
            rows.push(table.createRow(r))
            const hooks = Database.hooks.get(tableName)
            if (hooks) {
              const hookStream = Observable.from(hooks.insert)
                .concatMap(fn => fn(db, r))
                .skip(hooks.insert.length - 1)
              hookObservables.push(hookStream)
            }
          })
          hook = Observable.from(hookObservables)
            .concatAll()
            .skip(hookObservables.length - 1)
        } else {
          rows.push(table.createRow(data))
          const hooks = Database.hooks.get(tableName)
          if (hooks && hooks.insert) {
            hook = Observable.from(hooks.insert)
              .concatMap(fn => fn(db, data))
              .skip(hooks.insert.length - 1)
          }
        }
        return hook.concatMap(() => {
          return db.insertOrReplace()
            .into(table)
            .values(rows)
            .exec()
        })
      })
  }

  /**
   * 根据 SelectMetadata 中的元信息 join 出正确的数据结构
   * 比如 TaskTable 中是这样的结构:
   * TaskTable: {
   *   _id: PrimaryKey,
   *   _projectId: string, //Index
   *   note: string,
   *   content: string
   * }
   *
   * 根据 Schema 定义的 SelectMetadata 返回的结果是:
   * {
   *   _id: string,
   *   _projectId: string,
   *   note: string,
   *   content: string,
   *   project: {
   *     _id: string,
   *     name: string
   *   },
   *   subtasks: {
   *     _id: string,
   *     name: string,
   *     taskId: string
   *   }[]
   * }
   */
  get<T>(tableName: string, getQuery: GetQuery = Object.create(null)): QueryToken<T> {
    const primaryKey = this.primaryKeysMap.get(tableName)
    if (!primaryKey) {
      throw new TypeError(`table not exist: ${tableName}`)
    }
    // tableName => Set<uniqueKeys>
    const uniqueKeysMap = new Map<string, Set<string>>()
    const leftJoinQueue: LeftJoinMetadata[] = []
    const selectMeta$ = this.database$
      .map(db => this.buildLeftjoinQuery<T>(db, tableName, getQuery, uniqueKeysMap, leftJoinQueue))
    return new QueryToken(selectMeta$)
  }

  /**
   * 只可以更新单条数据
   */
  update<T>(tableName: string, primaryValue: string, patch: T) {
    const primaryKey = this.primaryKeysMap.get(tableName)
    if (!primaryKey) {
      return Observable.throw(new TypeError(`table not exist: ${tableName}`))
    }
    const selectMetadata = this.selectMetaData.get(tableName)
    return this.database$
      .concatMap(db => {
        const table = db.getSchema().table(tableName)
        let updateQuery: lf.query.Update | TypeError | undefined
        forEach(patch, (val, key) => {
          const row = table[key]
          const virtualMeta = selectMetadata.virtualMeta.get(key)
          if (typeof row === 'undefined') {
            console.warn(`patch key is not defined in table: ${key}`)
          } else if (key === primaryKey) {
            updateQuery = new TypeError(`Can not update primaryKey`)
          } else if (!virtualMeta) {
            const hiddenRow = table[`${Database.hn}${key}`]
            if (hiddenRow) {
              const mapFn = selectMetadata.mapper.get(key)
              updateQuery = db.update(table)
                .set(hiddenRow, val)
                .set(row, mapFn(val))
            } else {
              updateQuery = db.update(table)
                .set(row, val)
            }
          }
        })
        if (updateQuery instanceof TypeError) {
          return Promise.reject(updateQuery)
        } else if (updateQuery) {
          return updateQuery
            .where(table[primaryKey].eq(primaryValue))
            .exec()
        } else {
          return Promise.resolve()
        }
      })
  }

  /**
   * 如果有 deleteHook 先查询出数据，然后用 transaction 执行 deleteHook
   * 如果没有则直接删除
   * hook 中任意一个执行失败即会回滚，并抛出异常
   */
  delete(tableName: string, deleteQuery: {
    where?: (table: lf.schema.Table) => lf.Predicate
    primaryValue?: string
  } = Object.create(null)) {
    const primaryKey = this.primaryKeysMap.get(tableName)
    if (!primaryKey) {
      return Observable.throw(new TypeError(`table not exist: ${tableName}`))
    }
    return this.database$
      .concatMap(db => {
        const table = db.getSchema().table(tableName)
        let predicate: lf.Predicate
        if (deleteQuery.primaryValue) {
          predicate = table[primaryKey].eq(deleteQuery.primaryValue)
        } else if (deleteQuery.where) {
          try {
            predicate = deleteQuery.where(table)
          } catch (e) {
            return Observable.throw(e)
          }
        }
        const hooks = Database.hooks.get(tableName)
        let hookStream = Observable.of(db)
        const getQuery = deleteQuery.primaryValue ? { primaryValue: deleteQuery.primaryValue } : {
          where: deleteQuery.where
        }
        if (hooks.destroy && hooks.destroy.length) {
          const tx = db.createTransaction()
          hookStream = this.get(tableName, getQuery)
            .value()
            .flatMap(flat)
            .concatMap(r => Observable.from(hooks.destroy)
              .map(fn => fn(db, r))
            )
            .toArray()
            .concatMap(r => tx.exec(r))
            .catch(e => tx.rollback()
              .then(() => Promise.reject(e))
            )
            .mapTo(db)
        }
        return hookStream.concatMap(() => {
          let query = db.delete()
            .from(table)
          if (predicate) {
            query = query.where(predicate)
          }
          return query.exec()
        })
      })
  }

  dispose() {
    const disposeQueue: Promise<any>[] = []
    this.primaryKeysMap.forEach((_, tableName) => {
      const deleteQuery = this.database$
        .concatMap(db => {
          const table = db.getSchema().table(tableName)
          return db.delete().from(table).exec()
        })
        .toPromise()
      disposeQueue.push(deleteQuery)
    })
    return Promise.all(disposeQueue)
      .then(() => {
        // restore hooks
        Database.hooks.forEach(hooksDef => {
          hooksDef.insert = []
          hooksDef.destroy = []
        })
      })
  }

  private buildTables() {
    Database.schemaMetaData.forEach((schemaDef, tableName) => {
      const tableBuilder = this.schemaBuilder.createTable(tableName)
      this.buildTableRows(tableName, schemaDef, tableBuilder)
    })
    delete Database.schemaMetaData
  }

  /**
   * 解析 schemaMetaData
   * 根据解析后的 metadata 建表
   * 根据 metadata 中定义的关联关系新建 store hook
   */
  private buildTableRows(
    tableName: string,
    schemaMetaData: SchemaDef,
    tableBuilder: lf.schema.TableBuilder
  ) {
    const uniques: string[] = []
    const indexes: string[] = []
    const primaryKey: string[] = []
    const nullable: string[] = []
    const fields = new Set<string>()
    const virtualMeta = new Map<string, VirtualMetadata>()
    const mapper = new Map<string, Function>()
    forEach(schemaMetaData, (def, key) => {
      if (!def.virtual) {
        tableBuilder = this.addRow(tableBuilder, key, def.type, nullable, def)
        fields.add(key)
        if (def.primaryKey) {
          primaryKey.push(key)
          this.primaryKeysMap.set(tableName, key)
        } else if (def.unique != null) {
          uniques.push(key)
        } else if (def.index) {
          indexes.push(key)
        } else {
          nullable.push(key)
        }
      } else {
        fields.delete(key)
        virtualMeta.set(key, {
          where: def.virtual.where,
          name: def.virtual.name,
          fields: new Set(def.virtual.fields)
        })
        Database.defineHook(tableName, {
          insert: (db: lf.Database, entity: any) => {
            return this.createInsertHook(db, tableName, key, def, entity)
          }
        })
      }
      if (def['isHidden']) {
        Database.defineHook(tableName, {
          insert: (_db: lf.Database, entity: any) => {
            return new Promise(resolve => {
              const hiddenVal = entity[key]
              const mapFn = def['hiddenMapper']
              entity[`${Database.hn}${key}`] = hiddenVal
              entity[key] = mapFn(hiddenVal)
              mapper.set(key, mapFn)
              resolve()
            })
          }
        })
      }
    })
    const selectResult = { fields, virtualMeta, mapper }
    this.selectMetaData.set(tableName, selectResult)
    tableBuilder = tableBuilder.addPrimaryKey(primaryKey)
    if (indexes.length) {
      tableBuilder.addIndex('index', indexes)
    }
    if (uniques.length) {
      tableBuilder.addUnique('unique', uniques)
    }
    if (nullable.length) {
      tableBuilder.addNullable(nullable)
    }
    return selectResult
  }

  /**
   * 在 normalize 的时候定义 insertHook
   * 在 insert 数据到这个 table 的时候调用
   * 这里新建的 hook 是把 schemaMetaData 中的关联的数据剥离，单独存储
   * 存储的时候会验证 virtual props 的类型与之前存储时是否一致。比如：
   * 第一次存的时候是 Object 类型，第二次却存了 Array 类型
   * 比如第一次存:
   * {
   *   project: { _id: '03a9f4' }
   * },
   * 第二次:
   * {
   *   project: [ { _id: '03a9f4' } ]
   * }
   */
  private createInsertHook(
    db: lf.Database,
    tableName: string,
    key: string,
    def: SchemaMetadata,
    entity: any
  ) {
    const virtualProp: any = entity[key]
    if (virtualProp) {
      const primaryKey = this.primaryKeysMap.get(def.virtual.name)
      const virtualTable = db.getSchema().table(def.virtual.name)
      const virtualMetadata = this.selectMetaData
            .get(tableName)
            .virtualMeta
      const resultType = virtualMetadata.get(key)
            .resultType
      const tx = db.createTransaction()
      if (typeof virtualProp === 'object') {
        if (virtualProp instanceof Array) {
          if (resultType) {
            if (resultType !== 'Collection') {
              return Promise.reject(new TypeError(`Invalid resultType ${key}`))
            }
          } else {
            virtualMetadata.get(key)
              .resultType = 'Collection'
            let virtualTableMetadataDescription = this.virtualTableMetadataDescription.get(tableName)
            if (!virtualTableMetadataDescription) {
              virtualTableMetadataDescription = new Map<string, VirtualTableMetadataDescription>()
            }
            virtualTableMetadataDescription.set(def.virtual.name, {
              resultType: 'Collection', key
            })
            this.virtualTableMetadataDescription.set(tableName, virtualTableMetadataDescription)
          }
          const inertQueue = Promise.all(virtualProp.map(_virtualProp => {
            return this.insertOrUpdateVirtualProp(db, primaryKey, virtualTable, _virtualProp)
          }))
          return Observable.fromPromise(inertQueue)
            .concatMap(querys => {
              if (querys.length) {
                return tx.exec(querys)
              } else {
                return Observable.empty()
              }
            })
            .catch(e => tx.rollback()
              .then(() => Promise.reject(e))
            )
            .do(() => delete entity[key])
            .toPromise()
        } else {
          if (resultType) {
            if (resultType !== 'Model') {
              return Promise.reject(new TypeError(`Invalid resultType ${key}`))
            }
          } else {
            virtualMetadata.get(key)
              .resultType = 'Model'
            const virtualTableMetadataDescription = new Map<string, VirtualTableMetadataDescription>()
            virtualTableMetadataDescription.set(def.virtual.name, {
              resultType: 'Model', key
            })
            this.virtualTableMetadataDescription.set(tableName, virtualTableMetadataDescription)
          }
          return this.insertOrUpdateVirtualProp(db, primaryKey, virtualTable, virtualProp)
            .then(query => tx.exec([query]))
            .then(() => delete entity[key])
            .catch(e => tx.rollback()
              .then(() => Promise.reject(e))
            )
        }
      } else {
        return Promise.reject( new TypeError(`Invalid value ${virtualProp}, expect it is Object or Array`) )
      }
    } else {
      return Promise.resolve()
    }
  }

  /**
   * 将 virtual prop 分离存储
   * 比如 TaskSchema:
   * {
   *   _id: TaskId,
   *   project: {
   *     _id: ProjectId,
   *     name: string
   *   }
   *   ...
   * }
   * 这个方法会将 project 字段从 TaskSchema 上剥离，存储到对应的 Project 表中
   * 表的名字定义在 schemaMetaData 中
   */
  private insertOrUpdateVirtualProp (
    db: lf.Database,
    primaryKey: string,
    virtualTable: lf.schema.Table,
    virtualProp: any
  ): Promise<lf.query.Builder> {
    return db.select()
      .from(virtualTable)
      .where(virtualTable[primaryKey].eq(virtualProp[primaryKey]))
      .exec()
      .then(result => {
        if (result.length) {
          const updateQuery = db.update(virtualTable)
            .where(virtualTable[primaryKey].eq(virtualProp[primaryKey]))
          forEach(virtualProp, (prop, propName) => {
            if (propName !== primaryKey) {
              updateQuery.set(virtualTable[propName], prop)
            }
          })
          return updateQuery
        } else {
          const row = virtualTable.createRow(virtualProp)
          return db.insert()
            .into(virtualTable)
            .values([row])
        }
      })
  }

  private buildLeftjoinQuery<T>(
    db: lf.Database,
    tableName: string,
    getQuery: GetQuery,
    uniqueKeysMap: Map<string, Set<string>>,
    leftJoinQueue: LeftJoinMetadata[]
  ) {
    const primaryKey = this.primaryKeysMap.get(tableName)
    const selectMetadata = this.selectMetaData.get(tableName)
    const virtualMetadatas = selectMetadata.virtualMeta
    // tableName => metaData
    const virtualMap = new Map<string, VirtualTableMetadataDescription>()
    let mainPredicate: lf.Predicate | null
    const mainTable = db.getSchema().table(tableName)
    const colums: lf.schema.Column[] = []
    const hasQueryFields = !!getQuery.fields
    const fields = hasQueryFields ? new Set(getQuery.fields) : selectMetadata.fields
    fields.forEach(field => {
      const colum = mainTable[field]
      if (colum) {
        colums.push(colum)
        const hiddenName = `${Database.hn}${field}`
        const hiddenRow = mainTable[hiddenName]
        if (hiddenRow) {
          colums.push(hiddenRow)
        }
      }
    })
    virtualMetadatas.forEach((virtualMetadata, key) => {
      if ((hasQueryFields && fields.has(key)) || !hasQueryFields) {
        const table = db.getSchema().table(virtualMetadata.name)
        uniqueKeysMap.set(virtualMetadata.name, new Set())
        virtualMetadata.fields
          .forEach(field => {
            const colum = table[field]
            if (colum) {
              colums.push(colum)
            } else {
              console.warn(`field: ${field} in ${tableName}Schema's VirtualMetadata is not exist in table ${virtualMetadata.name}`)
            }
          })
        virtualMap.set(virtualMetadata.name, {
          key, resultType: virtualMetadata.resultType
        })
        let predicate: lf.Predicate
        try {
          predicate = virtualMetadata.where(table, mainTable)
          leftJoinQueue.push({ table, predicate })
        } catch (e) {
          console.warn(`Build Predicate Faild in ${virtualMetadata.name}, ${key}`, e)
        }
      }
    })
    let query = (<lf.query.Select>db.select.apply(db, colums))
      .from(mainTable)
    leftJoinQueue.forEach(val => {
      query = query.leftOuterJoin(val.table, val.predicate)
    })
    if (getQuery.where) {
      try {
        mainPredicate = getQuery.where(mainTable)
      } catch (e) {
        console.error(`Build predicate error: ${e.message}`)
      }
    }
    if (getQuery.primaryValue) {
      const primaryValueMatch = mainTable[primaryKey].eq(getQuery.primaryValue)
      if (mainPredicate) {
        mainPredicate = lf.op.and(mainPredicate, primaryValueMatch)
      } else {
        mainPredicate = primaryValueMatch
      }
    }
    return new SelectMeta<T>(db, query, (values: T[]) => {
      return this.fold<T>(tableName, values, uniqueKeysMap, leftJoinQueue)
    }, mainPredicate)
  }

  /**
   * 解析结果是 fold 的过程，将 leftJoin 的结果:
   * [
   *   {
   *     Project: { }
   *     Task: {}
   *     Subtask: {}
   *   }
   *   ...
   * ]
   * fold 成:
   * Task: {
   *   ...
   *   project: {}
   *   subtasks: [ ProjectSchema ]
   *   test: [ TestSchema ]
   * }
   */
  private fold<T>(
    tableName: string,
    values: any[],
    uniqueKeysMap: Map<string, Set<string>>,
    leftJoinQueue: LeftJoinMetadata[]
  ): T[] | null {
    const primaryKey = this.primaryKeysMap.get(tableName)
    const virtualMap = this.virtualTableMetadataDescription.get(tableName)
    if (values.length) {
      /**
       * 没有 leftJoin 直接获取结果
       * 有 leftJoin 需要先 fold 结果
       */
      if (leftJoinQueue.length) {
        const resultTable = new Map<string, Object[]>()
        forEach(values, value => {
          const mainResult = value[tableName] || Object.create(null)
          const primaryValue = mainResult[primaryKey]
          if (!primaryValue) {
            throw new TypeError(`Couldn't only select VirtualProp in a Table`)
          }
          const resultSet = resultTable.get(mainResult[primaryValue])
          if (!resultSet) {
            resultTable.set(mainResult[primaryKey], [value])
          } else {
            resultSet.push(value)
          }
        })
        const results: T[] = []
        resultTable.forEach(rows => {
          const result: T = rows[0][tableName]
          forEach(rows, row => {
            forEach(row, (value: any, key: string) => {
              const primaryValue = value[this.primaryKeysMap.get(key)]
              // leftOuterJoin 的值可能是 { _id: undefined, xxx: undefined }
              if (primaryValue) {
                const meta = virtualMap.get(key)
                const uniqueKeys = uniqueKeysMap.get(key)
                if (meta) {
                  if (meta.resultType === 'Model') {
                    result[meta.key] = value
                  } else {
                    if (result[meta.key] instanceof Array) {
                      if (!uniqueKeys.has(primaryValue)) {
                        result[meta.key].push(value)
                      }
                    } else {
                      result[meta.key] = [value]
                    }
                  }
                  uniqueKeys.add(primaryValue)
                }
              }
            })
          })
          results.push(this.restoreRaw(result))
        })
        return results
      } else {
        return values
      }
    }
    return null
  }

  private addRow(
    tableBuilder: lf.schema.TableBuilder,
    rowName: string,
    rdbType: RDBType,
    nullable: string[],
    def: SchemaMetadata
  ): lf.schema.TableBuilder {
    switch (rdbType) {
      case RDBType.ARRAY_BUFFER:
        return tableBuilder.addColumn(rowName, lf.Type.ARRAY_BUFFER)
      case RDBType.BOOLEAN:
        return tableBuilder.addColumn(rowName, lf.Type.BOOLEAN)
      case RDBType.DATE_TIME:
        const hiddenName = `${Database.hn}${rowName}`
        nullable.push(hiddenName)
        def['isHidden'] = true
        def['hiddenMapper'] = (val: string) => new Date(val)
        return tableBuilder.addColumn(rowName, lf.Type.INTEGER)
          .addColumn(hiddenName, lf.Type.STRING)
      case RDBType.INTEGER:
        return tableBuilder.addColumn(rowName, lf.Type.INTEGER)
      case RDBType.LITERAL_ARRAY:
        return tableBuilder.addColumn(rowName, lf.Type.OBJECT)
      case RDBType.NUMBER:
        return tableBuilder.addColumn(rowName, lf.Type.NUMBER)
      case RDBType.OBJECT:
        return tableBuilder.addColumn(rowName, lf.Type.OBJECT)
      case RDBType.STRING:
        return tableBuilder.addColumn(rowName, lf.Type.STRING)
      default:
        throw new TypeError(`not a valid type`)
    }
  }

  /**
   * 将 hiddenValue 还原到原来的字段
   */
  private restoreRaw<T>(value: T): T {
    forEach(value, (_val, key) => {
      const hiddenName = `${Database.hn}${key}`
      const hiddenValue = value[hiddenName]
      if (hiddenValue) {
        delete value[hiddenName]
        value[key] = hiddenValue
      }
    })
    return value
  }
}
