import './RxOperator'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { lfFactory } from './lovefield'
import { RDBType, Association } from './DataType'
import { SelectMeta } from './SelectMeta'
import { QueryToken } from './QueryToken'
import { forEach, identity, clone } from '../utils'

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
  NON_DEFINED_PROPERTY_WARN,
  NON_EXISTENT_FIELD_WARN,
  BUILD_PREDICATE_FAILED_WARN,
  ALIAS_CONFLICT_ERR,
  NOT_IMPLEMENT_ERR,
  UNEXPECTED_ASSOCIATION_ERR,
  TRANSACTION_EXECUTE_FAILED
} from './RuntimeError'

export interface SchemaMetadata {
  type: RDBType | Association
  primaryKey?: boolean
  index?: boolean
  unique?: boolean
  // alias先不建议使用，还有些细节值得确定, 考虑是否将insert/update的结果一样以`as`的形式输出
  as?: string
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
  name: string // table name
  resultType?: 'Collection' | 'Model'
  where(table: lf.schema.Table, targetTable: lf.schema.Table): lf.Predicate
}

export interface SelectMetadata {
  fields: Set<string>
  virtualMeta: Map<string, VirtualMetadata>
  mapper: Map<string, Function>
}

export type FieldsValue = string | { [index: string]: FieldsValue[] }

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
  private tableShapeMap = new Map<string, Object>()

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
   * 这些 hook 的过程都会被放置在一个transaction中执行
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

  insert<T>(tableName: string, raw: T[]): Observable<T[]>

  insert<T>(tableName: string, raw: T): Observable<T>

  insert<T>(tableName: string, raw: T | T[]): Observable<T> | Observable<T[]>

  /**
   * 存储数据到数据表
   * 先执行 insert hook 列表中的 hook 再存储
   * insertHooks 是一些 lovefield query
   * 它们将在一个 transaction 中被串行执行，任意一个失败回滚所有操作并抛出异常
   */
  insert<T>(tableName: string, raw: T | T[]): Observable<T> | Observable<T[]> {
    return this.database$
      .concatMap(db => {
        const table = db.getSchema().table(tableName)
        let hook: Observable<any> = Observable.of(null)
        const rows: lf.Row[] = []

        const data = clone(raw)
        if (data instanceof Array) {
          const hookObservables: Observable<lf.Transaction>[] = []
          const hooks = Database.hooks.get(tableName)

          data.forEach(r => {
            rows.push(table.createRow(r))
            if (!hooks || !hooks.insert || !hooks.insert.length) {
              return null
            }

            const hookStream = Observable.from(hooks.insert)
              .concatMap(fn => fn(db, r))
              .skip(hooks.insert.length - 1)

            hookObservables.push(hookStream)
          })

          if (hooks && hookObservables.length) {
            hook = Observable.from(hookObservables)
              .concatAll()
              .skip(hookObservables.length - 1)
          }

        } else {
          rows.push(table.createRow(data))
          const hooks = Database.hooks.get(tableName)

          if (hooks && hooks.insert && hooks.insert.length) {
            hook = Observable.from(hooks.insert)
              .concatMap(fn => fn(db, data))
              .skip(hooks.insert.length - 1)
          }
        }

        const tx = db.createTransaction()
        return hook.concatMap(() => {
          return tx.exec([db.insertOrReplace()
            .into(table)
            .values(rows)])
        })
        .flatMap(identity)
        .catch(() => tx.rollback().then(() => []))
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
    const selectMetadata = this.selectMetaData.get(tableName)
    const primaryKey = this.primaryKeysMap.get(tableName)

    return this.database$
      .concatMap<any, any>(db => {
        const table = db.getSchema().table(tableName)
        let updateQuery: lf.query.Update | TypeError | undefined

        let predicate: lf.Predicate

        if (clause.primaryValue !== undefined) {
          if (!primaryKey) {
            return Observable.throw(NON_EXISTENT_PRIMARY_KEY_ERR(tableName))
          }

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
  delete<T>(tableName: string, clause: ClauseDescription = {}): Observable<T[]> {
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
            .values()
            .flatMap(identity)
            .concatMap(r => Observable.from(hooks.destroy)
              .map(fn => fn(db, r))
            )
            .toArray()
            .concatMap(r => tx.exec(r))
            .catch(e => tx.rollback()
              .then(() => Promise.reject(TRANSACTION_EXECUTE_FAILED(e)))
            )
            .mapTo(db)
        }

        return hookStream.concatMap(() => {
          let _query = db.delete().from(table)
          _query = predicate ? _query.where(predicate) : _query
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
        // review: hooks似乎应该是跟随database实例更好？
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
        tableBuilder = this.addRow(tableBuilder, key, def.type as RDBType, nullable, def)
        fields.add(key)

        let tags: boolean[] = []

        if (def.primaryKey) {
          primaryKey.push(key)
          this.primaryKeysMap.set(tableName, key)
          tags.push(true)
        }

        if (def.unique) {
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

      // create a hidden column in table and make compare datetime easier
      // not elegant but it worked
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
    this.buildTableShape(tableName, schemaMetaData)

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

  private buildTableShape(tableName: string, metadata: SchemaDef) {
    let definedShape = this.tableShapeMap.get(tableName)
    if (definedShape && Object.keys(definedShape).length > 0) {
      return
    }

    let shape = definedShape || Object.create(null)
    forEach(metadata, (value, key) => {
      const label = value.as ? value.as : key
      const matcher = {
        column: `${tableName}__${key}`,
        id: !!value.primaryKey
      }

      if (!value.virtual) {
        if (shape[label] !== undefined) {
          throw ALIAS_CONFLICT_ERR(label, tableName)
        }
        shape[label] = matcher
      } else {
        const virtualTableName = value.virtual.name
        const virtualRule = this.tableShapeMap.get(virtualTableName)
        if (virtualRule && Object.keys(virtualRule).length > 0) {
          switch (value.type) {
            case Association.oneToOne:
              shape[label] = virtualRule
              break
            case Association.oneToMany:
              shape[label] = [virtualRule]
              break
            case Association.manyToMany:
              throw NOT_IMPLEMENT_ERR()
            default:
              throw UNEXPECTED_ASSOCIATION_ERR()
          }
        } else {
          shape[label] = {}
          this.tableShapeMap.set(virtualTableName, shape[label])
        }
      }
    })

    this.tableShapeMap.set(tableName, shape)
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
    const virtualMetadata = this.selectMetaData.get(tableName).virtualMeta
    const resultType = virtualMetadata.get(key).resultType

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

      const insertQueue = Promise.all(virtualProp.map(data => {
        return this.upsertVirtualProp(db, primaryKey, virtualTable, data)
      }))

      return Observable.fromPromise(insertQueue)
        .do(() => delete entity[key])
        .reduce((acc, curr) => acc.concat(curr))
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

      return this.upsertVirtualProp(db, primaryKey, virtualTable, virtualProp)
        .then(() => delete entity[key])
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
  private upsertVirtualProp<T> (
    db: lf.Database,
    primaryKey: string,
    table: lf.schema.Table,
    data: T
  ) {
    const clause = () =>
      table[primaryKey].eq(data[primaryKey])

    return db.select().from(table)
      .where(clause())
      .exec()
      .then((rows) => {
        if (rows.length) {
          return this.update(table.getName(), {
            where: clause
          }, rows[0]).toPromise()
        } else {
          return this.insert<T>(table.getName(), data).toPromise()
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
    const virtualMetadata = selectMetadata.virtualMeta
    // tableName => metaData
    const virtualMap = new Map<string, VirtualTableMetadataDescription>()
    const leftJoinQueue: LeftJoinMetadata[] = []
    let mainPredicate: lf.Predicate | null
    const mainTable = db.getSchema().table(tableName)
    const hasQueryFields = !!queryClause.fields

    let fields = queryClause.fields
    const isKeyQueried = queryClause.fields ? queryClause.fields.indexOf(primaryKey) > -1 : true
    if (!isKeyQueried) {
      fields = fields.concat(primaryKey)
    }
    const queriedFields: Set<FieldsValue> = hasQueryFields ? new Set(fields) : selectMetadata.fields
    let { columns, allFields } = this.buildColumns(db, tableName, queriedFields, !hasQueryFields)

    virtualMetadata.forEach((virtual, key) => {
      if ((hasQueryFields && key in allFields) || !hasQueryFields) {
        const table = db.getSchema().table(virtual.name)

        uniqueKeysMap.set(virtual.name, new Set())
        virtualMap.set(virtual.name, {
          key, resultType: virtual.resultType
        })

        let predicate: lf.Predicate
        try {
          predicate = virtual.where(table, mainTable)
          leftJoinQueue.push({ table, predicate })
        } catch (e) {
          BUILD_PREDICATE_FAILED_WARN(e, virtual.name, key)
        }
      }
    })

    let query = (db.select.apply(db, columns) as lf.query.Select).from(mainTable)

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

    const shape = this.tableShapeMap.get(tableName)
    let filteredShape = {}
    forEach(shape, (value, key) => {
      if (key in allFields) {
        filteredShape[key] = value
      }
    })

    return new SelectMeta<T>(db, query, {
      primaryKey: {
        queried: isKeyQueried,
        name: primaryKey
      },
      definition: filteredShape
    }, mainPredicate)
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
        def['hiddenMapper'] = (val: string) => val ? new Date(val) : new Date(0)
        return tableBuilder
          .addColumn(rowName, lf.Type.INTEGER)
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

  private buildColumns(
    db: lf.Database,
    tableName: string,
    fieldTree: Set<FieldsValue>,
    glob: boolean = false
  ) {
    const currentTable = db.getSchema().table(tableName)
    const virtualTable = this.selectMetaData.get(tableName)

    let columns: lf.schema.Column[] = []
    let allFields: Object = {}
    let association: string[] = []

    if (glob) {
      virtualTable.virtualMeta.forEach((_, asso) => {
        fieldTree.add(asso)
        association.push(asso)
      })
    }

    fieldTree.forEach((field, _) => {
      if (typeof field === 'string' && association.indexOf(field) === -1) {
        const column = currentTable[field]
        if (column) {
          const hiddenName = `${Database.hn}${field}`
          const hiddenRow = currentTable[hiddenName]
          const fieldName = `${tableName}__${column.getName()}`
          const col = hiddenRow ? hiddenRow.as(fieldName) : column.as(fieldName)
          columns.push(col)
          allFields[field] = true
        } else {
          NON_EXISTENT_FIELD_WARN(field, tableName)
        }
      } else if (typeof field === 'object') {
        forEach(field, (value, key) => {
          let associateName: string
          try {
            associateName = virtualTable.virtualMeta.get(key).name
          } catch (e) {
            NON_DEFINED_PROPERTY_WARN(key)
            return
          }
          const ret = this.buildColumns(db, associateName, new Set(value as FieldsValue[]), glob)
          columns = columns.concat(ret.columns)
          allFields[key] = ret.allFields
        })
      } else if (typeof field === 'string') {
          let associateName: string
          try {
            associateName = virtualTable.virtualMeta.get(field).name
          } catch (e) {
            NON_DEFINED_PROPERTY_WARN(field)
            return
          }
          const nestFields = this.selectMetaData.get(associateName).fields
          const ret = this.buildColumns(db, associateName, new Set(nestFields), true)
          columns = columns.concat(ret.columns)
          allFields[field] = ret.allFields
      }
    })

    return { columns, allFields }
  }

}
