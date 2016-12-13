import './RxOperator'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { lfFactory } from './lovefield'
import { RDBType } from './DataType'
import { SelectMeta } from './SelectMeta'
import { QueryToken } from './QueryToken'
import { forEach, flat } from '../utils'

import {
  DEFINE_HOOK_ERR,
  NON_EXISTENT_TABLE_ERR,
  UNMODIFIABLE_TABLE_SCHEMA_ERR,
  UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR,
  NON_EXISTENT_PRIMARY_KEY_ERR,
  UNMODIFIABLE_PRIMARYKEY_ERR,
  NON_EXISTENT_COLUMN_ERR,
  INVALID_RESULT_TYPE_ERR,
  INVALID_ROW_TYPE_ERR,
  INVALID_VIRTUAL_VALUE_ERR,
  INVALID_FIELD_DES_ERR,
  NON_DEFINED_PROPERTY_WARN,
  NON_EXISTENT_FIELD_WARN,
  BUILD_PREDICATE_FAILED_WARN
} from './RuntimeError'

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
    where(table: lf.schema.Table, data: lf.schema.Table): lf.Predicate
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
  resultType?: 'Collection' | 'Model'
  where(table: lf.schema.Table, targetTable: lf.schema.Table): lf.Predicate
}

export interface SelectMetadata {
  fields: Set<string>
  virtualMeta: Map<string, VirtualMetadata>
  mapper: Map<string, Function>
}

type FieldsValue = string | { [index: string]: string[] }

// todo primary是optional？？？
export interface GetQuery {
  fields?: FieldsValue[]
  primaryValue?: string | number
  where? (table: lf.schema.Table): lf.Predicate
}

export interface VirtualTableMetadataDescription {
  key: string
  resultType: 'Model' | 'Collection'
}

export interface ClauseDescription {
  where?(table: lf.schema.Table): lf.Predicate
  primaryValue?: string | number
}

export interface QueryDescription extends ClauseDescription {
  fields?: FieldsValue[]
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

  private primaryKeysMap = new Map<string, string>()
  private selectMetaData = new Map<string, SelectMetadata>()
  private virtualTableMetadataDescription = new Map<string, Map<string, VirtualTableMetadataDescription>>()

  /**
   * 定义数据表的 metadata
   * 会根据这些 metadata 决定增删改查的时候如何处理关联数据
   */
  static defineSchema(tableName: string, schemaMetaData: SchemaDef) {
    if (!Database.schemaMetaData) {
      throw UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR()
    }

    if (Database.schemaMetaData.has(tableName)) {
      throw UNMODIFIABLE_TABLE_SCHEMA_ERR(tableName)
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
      throw NON_EXISTENT_PRIMARY_KEY_ERR(schemaMetaData)
    }

    Database.schemaMetaData.set(tableName, schemaMetaData)
    Database.hooks.set(tableName, {
      insert: [],
      destroy: []
    })

    return Database
  }

  /**
   * 在数据表上定义一些 hook
   * 这些 hook 的过程都是 transaction 组成
   */
  static defineHook(tableName: string, hookDef: HookDef) {
    const hooks = Database.hooks.get(tableName)

    if (!hooks) {
      throw DEFINE_HOOK_ERR(tableName)
    }

    if (hookDef.insert) {
      hooks.insert.push(hookDef.insert)
    }

    if (hookDef.destroy) {
      hooks.destroy.push(hookDef.destroy)
    }

    return hookDef
  }

  constructor(
    storeType: lf.schema.DataStoreType = lf.schema.DataStoreType.MEMORY,
    enableInspector: boolean = false,
    // database name
    name = 'ReactiveDB',
    // database version
    version = 1
  ) {
    const schemaBuilder = lf.schema.create(name, version)
    this.database$ = lfFactory(schemaBuilder, { storeType, enableInspector })
    this.buildTables(schemaBuilder)
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
            if (!hooks) {
              return null
            }

            const hookStream = Observable.from(hooks.insert)
              .concatMap(fn => fn(db, r))
              .skip(hooks.insert.length - 1)

            hookObservables.push(hookStream)
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
  get<T>(tableName: string, query: QueryDescription = {}): QueryToken<T> {
    const primaryKey = this.primaryKeysMap.get(tableName)
    if (!primaryKey) {
      throw NON_EXISTENT_TABLE_ERR(tableName)
    }

    // tableName => Set<uniqueKeys>
    const uniqueKeysMap = new Map<string, Set<string>>()
    const selectMeta$ = this.database$
      .map(db => this.buildLeftjoinQuery<T>(db, tableName, query, uniqueKeysMap))

    return new QueryToken(selectMeta$)
  }

  update(tableName: string, clause: ClauseDescription, patch: Object) {
    const primaryKey = this.primaryKeysMap.get(tableName)
    if (!primaryKey) {
      return Observable.throw(NON_EXISTENT_TABLE_ERR(tableName))
    }

    const selectMetadata = this.selectMetaData.get(tableName)
    return this.database$
      .concatMap<any, any>(db => {
        const table = db.getSchema().table(tableName)
        let updateQuery: lf.query.Update | TypeError | undefined

        let predicate: lf.Predicate

        if (clause.primaryValue !== undefined) {
          predicate = table[primaryKey].eq(clause.primaryValue)
        } else if (clause.where) {
          try {
            predicate = clause.where(table)
          } catch (e) {
            return Observable.throw(e)
          }
        }

        forEach(patch, (val, key) => {
          const row = table[key]
          const virtualMeta = selectMetadata.virtualMeta.get(key)
          if (typeof row === 'undefined') {
            console.warn(NON_EXISTENT_COLUMN_ERR(key, tableName))
          } else if (key === primaryKey) {
            updateQuery = UNMODIFIABLE_PRIMARYKEY_ERR()
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
            .where(predicate)
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
  delete(tableName: string, clause: ClauseDescription = {}) {
    const primaryKey = this.primaryKeysMap.get(tableName)
    if (!primaryKey) {
      return Observable.throw(NON_EXISTENT_TABLE_ERR(tableName))
    }

    return this.database$
      .concatMap(db => {
        const table = db.getSchema().table(tableName)

        let predicate: lf.Predicate
        if (clause.primaryValue) {
          predicate = table[primaryKey].eq(clause.primaryValue)
        } else if (clause.where) {
          try {
            predicate = clause.where(table)
          } catch (e) {
            return Observable.throw(e)
          }
        }

        const hooks = Database.hooks.get(tableName)
        let hookStream = Observable.of(db)
        const query = clause.primaryValue ? { primaryValue: clause.primaryValue } : {
          where: clause.where
        }

        if (hooks.destroy && hooks.destroy.length) {
          const tx = db.createTransaction()
          hookStream = this.get(tableName, query)
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
          let _query = db.delete()
            .from(table)
          if (predicate) {
            _query = _query.where(predicate)
          }
          return _query.exec()
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
        // To Reviewer: hooks似乎应该是跟随database实例更好？
        Database.hooks.forEach(tableHookDef => {
          tableHookDef.insert = []
          tableHookDef.destroy = []
        })
      })
  }

  private buildTables(builder: lf.schema.Builder) {
    Database.schemaMetaData.forEach((schemaDef, tableName) => {
      const tableBuilder = builder.createTable(tableName)
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

        let tags: boolean[] = []

        if (def.primaryKey) {
          primaryKey.push(key)
          this.primaryKeysMap.set(tableName, key)
          tags.push(true)
        }

        if (def.unique != null) {
          uniques.push(key)
          tags.push(true)
        }

        if (def.index) {
          indexes.push(key)
          tags.push(true)
        }

        if (tags.length === 0) {
          nullable.push(key)
        }

      } else {
        fields.delete(key)
        virtualMeta.set(key, {
          where: def.virtual.where,
          name: def.virtual.name
        })

        Database.defineHook(tableName, {
          insert: (db: lf.Database, entity: any) => {
            return this.createInsertHook(db, tableName, key, def, entity)
          }
        })
      }

      if (!def['isHidden']) {
        return null
      }
      // dirty below
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
    if (!virtualProp) {
      return Promise.resolve()
    }

    if (typeof virtualProp !== 'object') {
      return Promise.reject(INVALID_VIRTUAL_VALUE_ERR(virtualProp))
    }

    const primaryKey = this.primaryKeysMap.get(def.virtual.name)
    const virtualTable = db.getSchema().table(def.virtual.name)
    const virtualMetadata = this.selectMetaData
          .get(tableName)
          .virtualMeta
    const resultType = virtualMetadata.get(key).resultType
    const tx = db.createTransaction()

    if (virtualProp instanceof Array) {
      if (resultType && resultType !== 'Collection') {
        return Promise.reject(INVALID_RESULT_TYPE_ERR(key))
      } else {
        virtualMetadata.get(key).resultType = 'Collection'
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
        .concatMap(querys => querys.length ? tx.exec(querys) : Observable.empty())
        .catch(e => tx.rollback()
          .then(() => Promise.reject(e))
        )
        .do(() => delete entity[key])
        .toPromise()
    } else {
      if (resultType && resultType !== 'Model') {
        return Promise.reject(INVALID_RESULT_TYPE_ERR(key))
      } else {
        virtualMetadata.get(key).resultType = 'Model'
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
    queryClause: QueryDescription,
    uniqueKeysMap: Map<string, Set<string>>
  ) {
    const primaryKey = this.primaryKeysMap.get(tableName)
    const selectMetadata = this.selectMetaData.get(tableName)
    const virtualMetadatas = selectMetadata.virtualMeta
    // tableName => metaData
    const virtualMap = new Map<string, VirtualTableMetadataDescription>()
    const leftJoinQueue: LeftJoinMetadata[] = []
    let mainPredicate: lf.Predicate | null
    const mainTable = db.getSchema().table(tableName)
    const hasQueryFields = !!queryClause.fields
    const fields: Set<FieldsValue> = hasQueryFields ? new Set(queryClause.fields) : selectMetadata.fields
    const { columns, allFields } = this.buildColums(db, tableName, fields)

    virtualMetadatas.forEach((virtualMetadata, key) => {
      if ((hasQueryFields && allFields.has(key)) || !hasQueryFields) {
        const table = db.getSchema().table(virtualMetadata.name)
        uniqueKeysMap.set(virtualMetadata.name, new Set())
        virtualMap.set(virtualMetadata.name, {
          key, resultType: virtualMetadata.resultType
        })

        let predicate: lf.Predicate
        try {
          predicate = virtualMetadata.where(table, mainTable)
          leftJoinQueue.push({ table, predicate })
        } catch (e) {
          BUILD_PREDICATE_FAILED_WARN(e, virtualMetadata.name, key)
        }
      }
    })

    let query = (<lf.query.Select>db.select.apply(db, columns)).from(mainTable)

    leftJoinQueue.forEach(val => {
      query = query.leftOuterJoin(val.table, val.predicate)
    })

    if (queryClause.where) {
      try {
        mainPredicate = queryClause.where(mainTable)
      } catch (e) {
        BUILD_PREDICATE_FAILED_WARN(e)
      }
    }

    if (queryClause.primaryValue) {
      const primaryValueMatch = mainTable[primaryKey].eq(queryClause.primaryValue)
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

    if (!values.length) {
      return null
    }

    if (!leftJoinQueue.length) {
      return values
    }

    /**
     * 没有 leftJoin 直接获取结果
     * 有 leftJoin 需要先 fold 结果
     */
    const resultTable = new Map<string, Object[]>()

    forEach(values, value => {
      const mainResult = value[tableName] || Object.create(null)
      const primaryValue = mainResult[primaryKey]
      if (!primaryValue) {
        throw INVALID_FIELD_DES_ERR()
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
          const meta = virtualMap.get(key)
          const uniqueKeys = uniqueKeysMap.get(key)
          // leftOuterJoin 的值可能是 { _id: undefined, xxx: undefined }
          if (!primaryValue || !meta) {
            return null
          }

          if (meta.resultType === 'Model') {
            result[meta.key] = value
          } else {
            if ((result[meta.key] instanceof Array) && !uniqueKeys.has(primaryValue)) {
              result[meta.key].push(value)
            } else {
              result[meta.key] = [value]
            }
          }

          uniqueKeys.add(primaryValue)
        })
      })

      results.push(this.restoreRaw(result))
    })
    return results
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
        throw INVALID_ROW_TYPE_ERR()
    }
  }

  private buildColums(
    db: lf.Database,
    tableName: string,
    fields: Set<FieldsValue>
  ) {
    const mainTable = db.getSchema().table(tableName)
    const columns: lf.schema.Column[] = []
    const allFields = new Set<string>()

    fields.forEach(field => {
      if (typeof field === 'string') {
        const colum = mainTable[field]

        if (colum) {
          columns.push(colum)
          const hiddenName = `${Database.hn}${field}`
          const hiddenRow = mainTable[hiddenName]
          if (hiddenRow) {
            columns.push(hiddenRow)
          }
        }

        allFields.add(field)
      } else {
        const description = field
        forEach(description, (innerFields, propName) => {
          let virtualTableName: string
          try {
            virtualTableName = this.selectMetaData
              .get(tableName)
              .virtualMeta
              .get(propName)
              .name
          } catch (e) {
            NON_DEFINED_PROPERTY_WARN(propName)
          }

          const virtualTable = db.getSchema().table(virtualTableName)
          allFields.add(propName)

          forEach(innerFields, _field => {
            const column = virtualTable[_field]
            if (!column) {
              NON_EXISTENT_FIELD_WARN(propName, virtualTableName)
              return null
            }

            columns.push(column)
            const hiddenName = `${Database.hn}${field}`
            const hiddenRow = mainTable[hiddenName]
            if (hiddenRow) {
              columns.push(hiddenRow)
            }
          })
        })
      }
    })

    return { columns, allFields }
  }

  /**
   * 将 hiddenValue 还原到原来的字段
   * 比如 created 存储的时候是将数据存储为 new Date(created).valueOf()
   * 取这条数据的时候需要将它转变成原来的值
   */
  private restoreRaw<T>(entity: T): T {
    forEach(entity, (_, key) => {
      const hiddenName = `${Database.hn}${key}`
      const hiddenValue = entity[hiddenName]

      if (hiddenValue) {
        delete entity[hiddenName]
        entity[key] = hiddenValue
      }
    })

    return entity
  }
}
