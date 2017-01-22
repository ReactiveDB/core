import './RxOperator'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { lfFactory } from './lovefield'
import { RDBType, Association } from './DataType'
import { Selector } from './Selector'
import { QueryToken } from './QueryToken'
import { PredicateDescription, PredicateProvider } from './PredicateProvider'
import { forEach, identity, clone } from '../utils'
import version from '../version'

import {
  ReactiveDBError,
  DEFINE_HOOK_ERR,
  NON_EXISTENT_TABLE_ERR,
  UNMODIFIABLE_TABLE_SCHEMA_ERR,
  UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR,
  NON_EXISTENT_PRIMARY_KEY_ERR,
  UNMODIFIABLE_PRIMARYKEY_WARN,
  NON_EXISTENT_COLUMN_WARN,
  INVALID_NAVIGATINO_TYPE_ERR,
  INVALID_ROW_TYPE_ERR,
  INVALID_FIELD_DES_ERR,
  NON_DEFINED_PROPERTY_WARN,
  NON_EXISTENT_FIELD_WARN,
  BUILD_PREDICATE_FAILED_WARN,
  ALIAS_CONFLICT_ERR,
  NOT_IMPLEMENT_ERR,
  UNEXPECTED_ASSOCIATION_ERR,
  TRANSACTION_EXECUTE_FAILED,
  HOOK_EXECUTE_FAILED,
  INVALID_PATCH_TYPE_ERR
} from './RuntimeError'

export interface SchemaMetadata<T> {
  type: RDBType | Association
  primaryKey?: boolean
  index?: boolean
  unique?: boolean
  /**
   * alias to other table
   * 这里需要定义表名，字段和查询条件
   */
  virtual?: {
    name?: string
    where?(virtualTable: TableShape<T>): PredicateDescription
  }
  // 被 Database.prototype.createRow 动态挂上去的
  // readonly isHidden?: boolean
  // readonly hiddenMapper?: (val: any) => any
}

export type TableShape<T> = lf.schema.Table & {
  [P in keyof T]: lf.schema.Column
}

export type SchemaDef<T> = {
  [P in keyof T]: SchemaMetadata<T>
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
  name: string
  association?: Association
  where(table: lf.schema.Table, targetTable: lf.schema.Table): lf.Predicate
}

export interface SelectMetadata {
  fields: Set<string>
  virtualMeta: Map<string, VirtualMetadata>
  mapper: Map<string, Function>
}

export type FieldsValue = string | { [index: string]: FieldsValue[] }

export interface ClauseDescription {
  where?: PredicateDescription
}

export interface OrderDescription {
  fieldName: string
  orderBy?: 'DESC' | 'ASC'
}

export interface QueryDescription extends ClauseDescription {
  fields?: FieldsValue[]
  limit?: number
  skip?: number
  orderBy?: OrderDescription[]
}

export interface JoinInfo {
  table: lf.schema.Table,
  predicate: lf.Predicate
}

export type ShapeMatcher = {
  id: boolean
  column: string
  type?: string
}

export interface TraverseContext {
  [property: string]: number
}

export class Database {
  public static version = version
  /**
   * hidden row namespace
   * 比如 api 获取的 task.created 是 string 类型
   * 我们希望它存储为 number 类型（方便我们 Select 的时候对它进行一系列的条件运算
   * 那么可以在 Schema 上将它定义为:
   * RDBType.DATE_TIME
   * 然后 Database 类会将原始值存储到 __hidden__created 字段上
   * 存储的时候将原始值存储为 new Date(task.created).valueOf()
   */
  private static readonly __HIDDEN__ = '__hidden__'

  private static unwrapPredicate(table: lf.schema.Table, targetTable: lf.schema.Table, joinClause: Function) {
    try {
      return new PredicateProvider(targetTable, joinClause(table)).getPredicate()
    } catch (e) {
      BUILD_PREDICATE_FAILED_WARN(e, table.getName())
      return null
    }
  }

  private static getTable(db: lf.Database, ...tableNames: string[]) {
    return tableNames.map((name) => db.getSchema().table(name))
  }

  private static reviseAssocDefinition(assoc: Association, def: Object) {
    switch (assoc) {
      case Association.oneToOne:
        forEach(def, (value) => {
          if (value.id) {
            value.id = false
          }
        })
        break
      case Association.oneToMany:
        def = [def]
        break
      case Association.manyToMany:
        throw NOT_IMPLEMENT_ERR()
      default:
        throw UNEXPECTED_ASSOCIATION_ERR()
    }

    return def
  }

  database$: Observable<lf.Database>

  private hooks = new Map<string, HooksDef>()
  private schemaMetaData = new Map<string, SchemaDef<any>>()

  private primaryKeysMap = new Map<string, string>()
  private selectMetaData = new Map<string, SelectMetadata>()
  private schemaBuilder: lf.schema.Builder
  private connected = false

  /**
   * 定义数据表的 metadata
   * 会根据这些 metadata 决定增删改查的时候如何处理关联数据
   */
  defineSchema<T>(tableName: string, schemaMetaData: SchemaDef<T>) {
    if (this.connected) {
      throw UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR()
    }

    if (this.schemaMetaData.has(tableName)) {
      throw UNMODIFIABLE_TABLE_SCHEMA_ERR(tableName)
    }

    let hasPK = false
    // src: schemaMetaData; dest: hasPK;
    // short-curcuiting at the first meta that has primaryKey
    forEach(schemaMetaData, meta => {
      if (meta.primaryKey) {
        hasPK = true
        return false
      }
      return true
    })

    if (!hasPK) {
      throw NON_EXISTENT_PRIMARY_KEY_ERR(schemaMetaData as any)
    }

    Object.freeze(schemaMetaData)
    this.schemaMetaData.set(tableName, schemaMetaData)

    this.hooks.set(tableName, {
      insert: [],
      destroy: []
    })

    return this
  }

  /**
   * 在数据表上定义一些 hook
   * 这些 hook 的过程都会被放置在一个transaction中执行
   */
  defineHook(tableName: string, hookDef: HookDef) {
    if (this.connected) {
      throw UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR()
    }

    const hooks = this.hooks.get(tableName)

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
    this.schemaBuilder = lf.schema.create(name, version)
    this.database$ = lfFactory(this.schemaBuilder, { storeType, enableInspector })
  }

  connect() {
    this.buildTables(this.schemaBuilder)
    this.connected = true
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
  insert<T>(tableName: string, raw: T | T[]): Observable<T> | Observable<T[]> | Observable<void> {
    return this.database$
      .concatMap(db => {
        const [ table ] = Database.getTable(db, tableName)
        let hook: Observable<any> = Observable.of(null)
        const rows: lf.Row[] = []

        const data = clone(raw)
        if (data instanceof Array) {
          const hookObservables: Observable<lf.Transaction>[] = []
          const hooks = this.hooks.get(tableName)

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
          const hooks = this.hooks.get(tableName)

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
          .catch(e => Promise.reject(HOOK_EXECUTE_FAILED('insert', e)))
          .flatMap(identity)
          .catch((e) => {
            if (e instanceof ReactiveDBError) {
              return Promise.reject(e)
            }
            return tx.rollback()
              .then(() => Promise.reject(TRANSACTION_EXECUTE_FAILED(e)))
          })
      })
  }

  /**
   * 根据 SchemaMetadata 中的元信息 join 出正确的数据结构
   * 设有一表有如下结构：
   * {
   *   _id: PrimaryKey,
   *   note: string,
   *   content: string,
   *   subtasks: {
   *     type: Association.oneToMany
   *     virtual: {
   *       name: 'SubTask',
   *       where: (table) => ({
   *         _id: table.taskId
   *       })
   *     }
   *   }
   *
   * }
   *
   * 根据 Schema 定义的 metadata, 在`SELECT`时将会返回如下结果:
   * {
   *   _id: string,
   *   note: string,
   *   content: string,
   *   subtasks: [{
   *    ...subtask attribute
   *   }]
   * }
   */
  get<T>(tableName: string, query: QueryDescription = {}): QueryToken<T> {
    const pk = this.primaryKeysMap.get(tableName)
    if (!pk) {
      throw NON_EXISTENT_TABLE_ERR(tableName)
    }

    const selectMeta$ = this.database$
      .map(db => this.buildSelector<T>(db, tableName, query))

    return new QueryToken<T>(selectMeta$)
  }

  update(tableName: string, clause: ClauseDescription, patch: Object) {
    const selectMetadata = this.selectMetaData.get(tableName)
    const pk = this.primaryKeysMap.get(tableName)

    if (!selectMetadata) {
      return Observable.throw(NON_EXISTENT_TABLE_ERR(tableName))
    }

    const patchType = typeof patch
    const isArray = Array.isArray(patch)
    if (patchType !== 'object' || isArray) {
      throw INVALID_PATCH_TYPE_ERR(isArray ? 'Array' : patchType)
    }

    return this.database$
      .concatMap<any, any>(db => {
        const [ table ] = Database.getTable(db, tableName)
        let updateQuery: lf.query.Update

        let predicate: lf.Predicate

        if (clause.where) {
          try {
            predicate = new PredicateProvider(table, clause.where).getPredicate()
          } catch (e) {
            return Observable.throw(e)
          }
        }

        // source: patch; dest: updateQuery;
        // no short-curcuiting
        forEach(patch, (val, key) => {
          const column = table[key]
          const virtualMeta = selectMetadata.virtualMeta.get(key)

          if (typeof column === 'undefined') {
            NON_EXISTENT_COLUMN_WARN(key, tableName)
          } else if (key === pk) {
            UNMODIFIABLE_PRIMARYKEY_WARN()
          } else if (!virtualMeta) {
            const hiddenColumn = table[`${Database.__HIDDEN__}${key}`]
            updateQuery = (updateQuery || db.update(table))

            if (hiddenColumn) {
              const mapFn = selectMetadata.mapper.get(key)
              updateQuery
                .set(hiddenColumn, val)
                .set(column, mapFn(val))
            } else {
              updateQuery
                .set(column, val)
            }
          }
        })

        if (updateQuery) {
          return updateQuery.where(predicate).exec()
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
    const pk = this.primaryKeysMap.get(tableName)
    if (!pk) {
      return Observable.throw(NON_EXISTENT_TABLE_ERR(tableName))
    }

    return this.database$
      .concatMap(db => {
        const [ table ] = Database.getTable(db, tableName)
        let predicate: lf.Predicate
        if (clause.where) {
          try {
            predicate = new PredicateProvider(table, clause.where).getPredicate()
          } catch (e) {
            return Observable.throw(e)
          }
        }

        const hooks = this.hooks.get(tableName)
        let hookStream = Observable.of(db)
        const query = {
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
            .catch(e => Promise.reject(HOOK_EXECUTE_FAILED('delete', e)))
            .toArray()
            .concatMap(r => tx.exec(r))
            .catch(e => {
              if (e instanceof ReactiveDBError) {
                return Promise.reject(e)
              }
              return tx.rollback()
                .then(() => Promise.reject(TRANSACTION_EXECUTE_FAILED(e)))
            })
            .mapTo(db)
        }

        return hookStream.concatMap(() => {
          const deleteQuery = db.delete().from(table)
          if (predicate) {
            deleteQuery.where(predicate)
          }
          return deleteQuery.exec()
        })
      })
  }

  dispose() {
    const disposeQueue: Promise<any>[] = []

    this.primaryKeysMap.forEach((_, tableName) => {
      const deleteQuery = this.database$
        .concatMap(db => {
          const [ table ] = Database.getTable(db, tableName)
          return db.delete().from(table).exec()
        })
        .toPromise()

      disposeQueue.push(deleteQuery)
    })

    return Promise.all(disposeQueue)
      .then(() => {
        this.hooks.forEach(tableHookDef => {
          tableHookDef.insert = []
          tableHookDef.destroy = []
        })
      })
  }

  private buildTables(builder: lf.schema.Builder) {
    this.schemaMetaData.forEach((schemaDef, tableName) => {
      const tableBuilder = builder.createTable(tableName)
      this.buildTableRows(tableName, schemaDef, tableBuilder)
    })
  }

  /**
   * 解析 schemaMetaData
   * 根据解析后的 metadata 建表
   * 根据 metadata 中定义的关联关系新建 store hook
   */
  private buildTableRows(
    tableName: string,
    schemaMetaData: SchemaDef<any>,
    tableBuilder: lf.schema.TableBuilder
  ) {
    const uniques: string[] = []
    const indexes: string[] = []
    const primaryKey: string[] = []
    const nullable: string[] = []
    const fields = new Set<string>()
    const virtualMeta = new Map<string, VirtualMetadata>()
    const mapper = new Map<string, Function>()

    // src: schemaMetaData; dest: uniques, indexes, primaryKey, nullable, fields, vitualMeta, mapper
    // no short-curcuiting
    forEach(schemaMetaData, (def, key) => {
      if (!def.virtual) {
        tableBuilder = this.addRow(tableBuilder, key, def.type as RDBType, nullable, def)
        fields.add(key)

        const tags: boolean[] = []

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
          association: def.type as Association,
          name: def.virtual.name
        })

        this.defineHook(tableName, {
          insert: (db: lf.Database, entity: any) => {
            return this.createInsertHook(db, tableName, key, def, entity)
          }
        })
      }

      if (!def['isHidden']) {
        return
      }

      // create a hidden column in table and make compare datetime easier
      // not elegant but it worked
      this.defineHook(tableName, {
        insert: (_db: lf.Database, entity: any) => {
          return new Promise(resolve => {
            const hiddenVal = entity[key]
            const mapFn = def['hiddenMapper']
            entity[`${Database.__HIDDEN__}${key}`] = hiddenVal
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
   * 存储的时候会验证 virtual props 的类型与定义时候明确的关联关系是否一致
   */
  private createInsertHook(
    db: lf.Database,
    tableName: string,
    key: string,
    def: SchemaMetadata<any>,
    entity: any
  ) {
    const prop: any = entity[key]
    if (!prop) {
      return Promise.resolve()
    }

    const propType = typeof prop
    if (propType !== 'object') {
      return Promise.reject(INVALID_NAVIGATINO_TYPE_ERR(prop, ['Object / Array', propType]))
    }

    const virtualTableName = def.virtual.name
    const pk = this.primaryKeysMap.get(virtualTableName)
    const [ virtualTable ] = Database.getTable(db, virtualTableName)
    const virtualMetadata = this.selectMetaData.get(tableName).virtualMeta
    const recordType = virtualMetadata.get(key).association

    const virtualTableDef = virtualMetadata.get(key)
    virtualTableDef.name = virtualTableName

    switch (recordType) {
      case Association.oneToMany:
        if (!Array.isArray(prop)) {
          return Promise.reject(INVALID_NAVIGATINO_TYPE_ERR(key))
        }

        const insertQueue = Promise.all(prop.map(data => {
          return this.upsertVirtualProp(db, pk, virtualTable, data)
        }))

        return Observable.fromPromise(insertQueue)
          .do(() => delete entity[key])
          .reduce((acc, curr) => acc.concat(curr))
          .toPromise()

      case Association.oneToOne:
        if (propType !== 'object' || Array.isArray(prop)) {
          return Promise.reject(INVALID_NAVIGATINO_TYPE_ERR(key, ['Object', propType === 'object' ? 'Array' : propType]))
        }

        return this.upsertVirtualProp(db, pk, virtualTable, prop)
          .then(() => delete entity[key])

      case Association.manyToMany:
        return Promise.reject(NOT_IMPLEMENT_ERR())
      default:
        return Promise.reject(UNEXPECTED_ASSOCIATION_ERR())
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
    pk: string,
    table: lf.schema.Table,
    data: T
  ) {
    const clause = {
      [pk]: data[pk]
    }
    const predicate = new PredicateProvider(table, clause).getPredicate()
    return db.select().from(table)
      .where(predicate)
      .exec()
      .then((rows) => {
        if (rows.length) {
          return this
            .update(table.getName(), { where: clause }, data)
            .toPromise()
        } else {
          return this.insert<T>(table.getName(), data).toPromise()
        }
      })
  }

  private buildSelector<T>(
    db: lf.Database,
    tableName: string,
    queryClause: QueryDescription
  ) {
    const pk = this.primaryKeysMap.get(tableName)
    const selectMetadata = this.selectMetaData.get(tableName)
    const hasQueryFields = !!queryClause.fields

    const fields = queryClause.fields
    const isKeyQueried = queryClause.fields ? queryClause.fields.indexOf(pk) > -1 : true
    const queriedFields: Set<FieldsValue> = hasQueryFields ? new Set(fields) : selectMetadata.fields
    const {
      table,
      columns,
      joinInfo,
      definition
    } = this.traverseFields(db, tableName, queriedFields, isKeyQueried, !hasQueryFields)

    const query = (db.select.apply(db, columns) as lf.query.Select).from(table)
    joinInfo.forEach((info: JoinInfo) => {
      query.leftOuterJoin(info.table, info.predicate)
    })

    const orderDesc = queryClause.orderBy ? queryClause.orderBy
      .map(desc => ({
        column: table[desc.fieldName],
        orderBy: !desc.orderBy ? null : lf.Order[desc.orderBy]
      })) : []

    return new Selector<T>(db, query, {
        mainTable: table,
        pk: {
          queried: isKeyQueried,
          name: pk
        },
        definition: definition
      },
      new PredicateProvider(table, queryClause.where),
      queryClause.limit,
      queryClause.skip,
      orderDesc
    )
  }

  private addRow(
    tableBuilder: lf.schema.TableBuilder,
    rowName: string,
    rdbType: RDBType,
    nullable: string[],
    def: SchemaMetadata<any>
  ): lf.schema.TableBuilder {
    const hiddenName = `${Database.__HIDDEN__}${rowName}`

    switch (rdbType) {
      case RDBType.ARRAY_BUFFER:
        return tableBuilder.addColumn(rowName, lf.Type.ARRAY_BUFFER)
      case RDBType.BOOLEAN:
        return tableBuilder.addColumn(rowName, lf.Type.BOOLEAN)
      case RDBType.DATE_TIME:
        nullable.push(hiddenName);
        (def as any).isHidden = true;
        (def as any).hiddenMapper = (val: string) => val ? new Date(val).valueOf() : new Date(0).valueOf()
        return tableBuilder
          .addColumn(rowName, lf.Type.INTEGER)
          .addColumn(hiddenName, lf.Type.STRING)
      case RDBType.INTEGER:
        return tableBuilder.addColumn(rowName, lf.Type.INTEGER)
      case RDBType.LITERAL_ARRAY:
        nullable.push(hiddenName);
        (def as any).isHidden = true;
        (def as any).hiddenMapper = (val: any[]) => val ? val.join('|') : ''
        return tableBuilder
          .addColumn(rowName, lf.Type.STRING)
          .addColumn(hiddenName, lf.Type.OBJECT)
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

  // context 用来标记DFS路径中的所有出现过的表，用于解决self-join时的二义性
  // path 用来标记每个查询路径上出现的表，用于解决circular reference
  private traverseFields(
    db: lf.Database,
    tableName: string,
    fieldTree: Set<FieldsValue>,
    hasKey: boolean = true,
    glob: boolean = false,
    path: string[] = [],
    context: TraverseContext = {}
  ) {

    const tableInfo = this.selectMetaData.get(tableName)
    const allFields = Object.create(null)
    const definition = Object.create(null)
    const associationItem: string[] = []
    const associationMeta: string[] = []

    let columns: lf.schema.Column[] = []
    let joinInfo: JoinInfo[] = []
    let advanced: boolean = true

    if (path.indexOf(tableName) !== -1) {
      advanced = false
      return { columns, allFields, joinInfo, advanced, table: null, definition: null }
    } else {
      path.push(tableName)
    }

    tableInfo.virtualMeta.forEach((_, assoc) => {
      if (glob && path.indexOf(assoc) === -1) {
        fieldTree.add(assoc)
        associationItem.push(assoc)
      }
      associationMeta.push(assoc)
    })

    if (fieldTree.size === associationMeta.length
        && associationMeta.every((assoc) => fieldTree.has(assoc))) {
      throw INVALID_FIELD_DES_ERR()
    }

    if (!hasKey) {
      const pk = this.primaryKeysMap.get(tableName)
      fieldTree.add(pk)
    }

    const suffix = (context[tableName] || 0) + 1
    context[tableName] = suffix
    const contextName = `${tableName}@${suffix}`
    const currentTable = Database.getTable(db, tableName)[0].as(contextName)

    const handleAdvanced = (ret: any, key: string, assocDesc: VirtualMetadata) => {
      columns = columns.concat(ret.columns)
      allFields[key] = ret.allFields

      if (definition[key]) {
        throw ALIAS_CONFLICT_ERR(key, tableName)
      }
      definition[key] = Database.reviseAssocDefinition(assocDesc.association, ret.definition)

      const predicate = Database.unwrapPredicate(ret.table, currentTable, assocDesc.where)
      if (predicate) {
        joinInfo.push({ table: ret.table, predicate })
      }

      joinInfo = joinInfo.concat(ret.joinInfo)
    }

    fieldTree.forEach(field => {
      if (typeof field === 'string'
          && associationItem.indexOf(field) === -1
          && associationMeta.indexOf(field) === -1) {
        const column = currentTable[field]
        if (column) {
          const schema = this.schemaMetaData.get(tableName)
          const hiddenName = `${Database.__HIDDEN__}${field}`
          const hiddenCol = currentTable[hiddenName]
          const fieldName = `${contextName}__${field}`
          const col = hiddenCol ? hiddenCol.as(fieldName) : column.as(fieldName)

          columns.push(col)
          allFields[field] = true

          const matcher: ShapeMatcher = {
            column: fieldName,
            id: !!schema[field].primaryKey
          }

          if (schema[field].type === RDBType.LITERAL_ARRAY) {
            matcher.type = 'LiteralArray'
          }

          if (!definition[field]) {
            definition[field] = matcher
          } else {
            throw ALIAS_CONFLICT_ERR(field, tableName)
          }

        } else {
          NON_EXISTENT_FIELD_WARN(field, tableName)
        }
      } else if (typeof field === 'object') {
        forEach(field, (value, key) => {
          const assocDesc = tableInfo.virtualMeta.get(key)
          if (!assocDesc) {
            NON_DEFINED_PROPERTY_WARN(key)
            return
          }

          const pk = this.primaryKeysMap.get(key)
          const keyInFields = value.indexOf(pk) > -1
          const associationName = assocDesc.name
          const ret = this.traverseFields(
            db,
            associationName,
            new Set(value as FieldsValue[]),
            keyInFields,
            glob,
            path.slice(0),
            context
          )

          if (ret.advanced) {
            handleAdvanced(ret, key, assocDesc)
          }
        })
      } else if (typeof field === 'string' && associationMeta.indexOf(field) > -1) {
        const assocDesc = tableInfo.virtualMeta.get(field)
        if (!assocDesc) {
          NON_DEFINED_PROPERTY_WARN(field)
          return
        }

        const associationName = assocDesc.name
        const ret = this.traverseFields(
          db,
          associationName,
          this.selectMetaData.get(associationName).fields,
          true,
          true,
          path.slice(0),
          context
        )

        if (ret.advanced) {
          handleAdvanced(ret, field, assocDesc)
        }
      }
    })

    return { columns, allFields, joinInfo, advanced, table: currentTable, definition }
  }
}
