import { Observable } from 'rxjs/Observable'
import { Subscription } from 'rxjs/Subscription'
import { ConnectableObservable } from 'rxjs/observable/ConnectableObservable'
import * as lf from 'lovefield'
import * as Exception from '../exception'
import * as definition from './helper/definition'
import version from '../version'
import { Traversable } from '../shared'
import { Mutation, Selector, QueryToken, PredicateProvider } from './modules'
import { dispose, contextTableName, fieldIdentifier, hiddenColName } from './symbols'
import { forEach, clone, contains, tryCatch, hasOwn, getType, assert, identity, warn } from '../utils'
import { createPredicate, createPkClause, mergeTransactionResult, predicatableQuery, lfFactory } from './helper'
import { Relationship, RDBType, DataStoreType, LeafType, StatementType } from '../interface/enum'
import { Record, Fields, JoinInfo, Query, Clause, Predicate } from '../interface'
import { SchemaDef, ColumnDef, ParsedSchema, Association, ScopedHandler } from '../interface'
import { ColumnLeaf, NavigatorLeaf, ExecutorResult, UpsertContext, SelectContext } from '../interface'

export class Database {

  public static version = version

  public static getTables(db: lf.Database, ...tableNames: string[]) {
    return tableNames.map((name) => db.getSchema().table(name))
  }

  public database$: ConnectableObservable<lf.Database>

  private schemaDefs = new Map<string, SchemaDef<any>>()
  private schemas = new Map<string, ParsedSchema>()
  private schemaBuilder: lf.schema.Builder
  private connected = false
  // note thin cache will be unreliable in some eage case
  private storedIds = new Set<string>()
  private subscription: Subscription

  private findPrimaryKey = (name: string) => {
    return this.findSchema(name).pk
  }

  private findSchema = (name: string) => {
    const schema = this.schemas.get(name)
    assert(schema, Exception.NonExistentTable(name))
    return schema
  }

  /**
   * @method defineSchema
   * @description 定义数据表的 metadata, 通过ReactiveDB查询时会根据这些 metadata 决定如何处理关联数据
   */
  defineSchema<T>(tableName: string, schema: SchemaDef<T>) {
    const advanced = !this.schemaDefs.has(tableName) && !this.connected
    assert(advanced, Exception.UnmodifiableTable())

    const hasPK = Object.keys(schema)
      .some((key: string) => schema[key].primaryKey === true)
    assert(hasPK, Exception.PrimaryKeyNotProvided())

    this.schemaDefs.set(tableName, schema)
    return this
  }

  /**
   * @constructor ReactiveDB
   * @param storeType 定义使用的BackStore类型
   * @param enableInspector 是否允许外联Inspector
   * @param name 定义当前数据仓储的名字
   * @param version 定义当前数据仓储的版本
   */
  constructor(
    storeType: DataStoreType = DataStoreType.MEMORY,
    enableInspector: boolean = false,
    name = 'ReactiveDB',
    version = 1
  ) {
    this.schemaBuilder = lf.schema.create(name, version)
    this.database$ = lfFactory(this.schemaBuilder, { storeType, enableInspector })
  }

  connect() {
    this.buildTables()
    this.connected = true
    // definition should be clear once database is connected
    this.schemaDefs.clear()
    this.subscription = this.database$.connect()
  }

  dump() {
    return this.database$.concatMap(db => db.export())
  }

  load(data: any) {
    assert(!this.connected, Exception.DatabaseIsNotEmpty())

    return this.database$
      .concatMap(db => {
        forEach(data.tables, (entities: any[], name: string) => {
          const schema = this.findSchema(name)
          entities.forEach((entity: any) =>
            this.storedIds.add(fieldIdentifier(name, entity[schema.pk])))
        })
        return db.import(data).catch(() => {
          forEach(data.tables, (entities: any[], name: string) => {
            const schema = this.findSchema(name)
            entities.forEach((entity: any) =>
              this.storedIds.delete(fieldIdentifier(name, entity[schema.pk])))
          })
        })
      })
  }

  insert<T>(tableName: string, raw: T[]): Observable<ExecutorResult>

  insert<T>(tableName: string, raw: T): Observable<ExecutorResult>

  insert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult>

  insert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult> {
    return this.database$
      .concatMap(db => {
        const schema = this.findSchema(tableName)
        const pk = schema.pk
        const columnMapper = schema.mapper
        const [ table ] = Database.getTables(db, tableName)
        const muts: Mutation[] = []
        const entities = clone(raw)

        const iterator = Array.isArray(entities) ? entities : [entities]

        iterator.forEach((entity: any) => {
          const mut = new Mutation(db, table)
          const hiddenPayload = Object.create(null)

          columnMapper.forEach((mapper, key) => {
            // cannot create a hidden column for primary key
            if (!hasOwn(entity, key) || key === pk) {
              return
            }

            const val = entity[key]
            hiddenPayload[key] = mapper(val)
            hiddenPayload[hiddenColName(key)] = val
          })

          mut.patch({ ...entity, ...hiddenPayload })
          mut.withId(pk, entity[pk])
          muts.push(mut)
        })

        const { contextIds, queries } = Mutation.aggregate(db, muts, [])
        contextIds.forEach(id => this.storedIds.add(id))
        return this.executor(db, queries)
          .do({ error: () => contextIds.forEach(id => this.storedIds.delete(id)) })
      })
  }

  get<T>(tableName: string, query: Query<T> = {}): QueryToken<T> {
    const selector$ = this.buildSelector<T>(tableName, query)
    return new QueryToken<T>(selector$)
  }

  update<T>(tableName: string, clause: Clause<T>, raw: Partial<T>): Observable<ExecutorResult> {
    const type = getType(raw)
    if (type !== 'Object') {
      return Observable.throw(Exception.InvalidType(['Object', type]))
    }

    const [ schema, err ] = tryCatch<ParsedSchema>(this.findSchema)(tableName)
    if (err) {
      return Observable.throw(err)
    }

    return this.database$
      .concatMap<any, any>(db => {
        const entity = clone(raw)
        const [ table ] = Database.getTables(db, tableName)
        const columnMapper = schema.mapper
        const hiddenPayload = Object.create(null)

        columnMapper.forEach((mapper, key) => {
          // cannot create a hidden column for primary key
          if (!hasOwn(entity, key) || key === schema.pk) {
            return
          }

          const val = (entity as any)[key]
          hiddenPayload[key] = mapper(val)
          hiddenPayload[hiddenColName(key)] = val
        })

        const mut = { ...(entity as any), ...hiddenPayload }
        const predicate = createPredicate(table, clause.where)
        const query = predicatableQuery(db, table, predicate, StatementType.Update)

        forEach(mut, (val, key) => {
          const column = table[key]
          if (key === schema.pk) {
            warn(`Primary key is not modifiable.`)
          } else if (!column) {
            warn(`Column: ${key} is not existent on table:${tableName}`)
          } else {
            query.set(column, val)
          }
        })

        return this.executor(db, [query])
      })
  }

  delete<T>(tableName: string, clause: Clause<T> = {}): Observable<ExecutorResult> {
    const [pk, err] = tryCatch<string>(this.findPrimaryKey)(tableName)
    if (err) {
      return Observable.throw(err)
    }

    return this.database$
      .concatMap(db => {
        const [ table ] = Database.getTables(db, tableName)
        const column = table[pk]
        const provider = new PredicateProvider(table, clause.where)
        const prefetch =
          predicatableQuery(db, table, provider.getPredicate(), StatementType.Select, column)

        return Observable.fromPromise(prefetch.exec())
          .concatMap((scopedIds) => {
            const query = predicatableQuery(db, table, provider.getPredicate(), StatementType.Delete)

            scopedIds.forEach((entity: any) =>
              this.storedIds.delete(fieldIdentifier(tableName, entity[pk])))

            return this.executor(db, [query]).do({ error: () => {
              scopedIds.forEach((entity: any) =>
                this.storedIds.add(fieldIdentifier(tableName, entity[pk])))
            }})
          })
      })
  }

  upsert<T>(tableName: string, raw: T): Observable<ExecutorResult>

  upsert<T>(tableName: string, raw: T[]): Observable<ExecutorResult>

  upsert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult>

  upsert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult> {
    return this.database$.concatMap(db => {
      const sharing = new Map<any, Mutation>()
      const insert: Mutation[] = []
      const update: Mutation[] = []

      this.traverseCompound(db, tableName, clone(raw), insert, update, sharing)
      const { contextIds, queries } = Mutation.aggregate(db, insert, update)
      contextIds.forEach(id => this.storedIds.add(id))
      return this.executor(db, queries)
        .do({ error: () => contextIds.forEach(id => this.storedIds.delete(id)) })
    })
  }

  remove<T>(tableName: string, clause: Clause<T> = {}): Observable<ExecutorResult> {
    const [schema, err] = tryCatch<ParsedSchema>(this.findSchema)(tableName)
    if (err) {
      return Observable.throw(err)
    }
    const disposeHandler = schema.dispose

    return this.database$.concatMap((db) => {
      const [ table ] = Database.getTables(db, tableName)
      const predicate = createPredicate(table, clause.where)

      const queries: lf.query.Builder[] = []
      const removedIds: any = []
      queries.push(predicatableQuery(db, table, predicate, StatementType.Delete))

      const prefetch = predicatableQuery(db, table, predicate, StatementType.Select)
      return Observable.fromPromise(prefetch.exec())
        .concatMap((rootEntities) => {
          rootEntities.forEach(entity => {
            removedIds.push(fieldIdentifier(tableName, entity[schema.pk]))
          })

          if (disposeHandler) {
            const scope = this.createScopedHandler<T>(db, queries, removedIds)
            return disposeHandler(rootEntities, scope)
              .do(() => removedIds.forEach((id: string) => this.storedIds.delete(id)))
              .concatMap(() => this.executor(db, queries))
          } else {
            removedIds.forEach((id: string) => this.storedIds.delete(id))
            return this.executor(db, queries)
          }
        })
        .do({ error: () =>
          removedIds.forEach((id: string) => this.storedIds.add(id))
        })
    })
  }

  dispose() {
    if (!this.connected) {
      return Observable.throw(Exception.NotConnected())
    }

    const cleanup = this.database$.map(db =>
      db.getSchema().tables().map(t => db.delete().from(t)))

    return this.database$.concatMap(db => {
      return cleanup.concatMap(queries => this.executor(db, queries))
        .do(() => {
          db.close()
          this.schemas.clear()
          this.storedIds.clear()
          this.schemaBuilder = null
          this.subscription.unsubscribe()
        })
    })
  }

  private buildTables() {
    this.schemaDefs.forEach((schemaDef, tableName) => {
      const tableBuilder = this.schemaBuilder.createTable(tableName)
      this.parseSchemaDef(tableName, schemaDef, tableBuilder)
    })
  }

  /**
   * 解析 schemaDefs, 根据解析后的 metadata 建表
   */
  private parseSchemaDef(
    tableName: string,
    schemaDef: SchemaDef<any>,
    tableBuilder: lf.schema.TableBuilder
  ) {
    const uniques: string[] = []
    const indexes: string[] = []
    const primaryKey: string[] = []
    const nullable: string[] = []
    const columns = new Map<string, RDBType>()
    const associations = new Map<string, Association>()
    const mapper = new Map<string, Function>()
    const disposeHandler =
      (typeof schemaDef.dispose === 'function' && schemaDef.dispose) ||
      (typeof schemaDef[dispose] === 'function' && schemaDef[dispose]) || null

    // src: schemaDef; dest: uniques, indexes, primaryKey, nullable, associations, mapper
    // no short-curcuiting
    forEach(schemaDef, (def, key) => {
      if (typeof def === 'function') {
        return
      }

      if (!def.virtual) {
        this.createColumn(tableBuilder, key, def.type as RDBType, nullable, mapper)
        columns.set(key, def.type)

        if (def.primaryKey) {
          assert(!primaryKey[0], Exception.PrimaryKeyConflict())
          primaryKey.push(key)
        }

        if (def.unique) {
          uniques.push(key)
        }

        if (def.index) {
          indexes.push(key)
        }

        const isNullable = ![def.primaryKey, def.index, def.unique].some(identity)
        if (isNullable) {
          nullable.push(key)
        }
      } else {
        associations.set(key, {
          where: def.virtual.where,
          type: def.type as Relationship,
          name: def.virtual.name
        })
      }
    })

    this.schemas.set(tableName, {
      pk: primaryKey[0],
      mapper,
      columns,
      dispose: disposeHandler,
      associations
    })

    if (indexes.length) {
      tableBuilder.addIndex('index', indexes)
    }

    if (uniques.length) {
      tableBuilder.addUnique('unique', uniques)
    }

    if (nullable.length) {
      tableBuilder.addNullable(nullable)
    }

    tableBuilder.addPrimaryKey(primaryKey)
  }

  private buildSelector<T>(
    tableName: string,
    clause: Query<T>
  ) {
    return this.database$.map((db) => {
      const schema = this.findSchema(tableName)
      const pk = schema.pk
      const containFields = !!clause.fields

      const containKey = containFields ? contains(pk, clause.fields) : true
      const fields: Set<Fields> = containFields ? new Set(clause.fields) : new Set(schema.columns.keys())
      const { table, columns, joinInfo, definition } =
        this.traverseQueryFields(db, tableName, fields, containKey, !containFields)
      const query =
        predicatableQuery(db, table, null, StatementType.Select, ...columns)

      joinInfo.forEach((info: JoinInfo) =>
        query.leftOuterJoin(info.table, info.predicate))

      const orderDesc = (clause.orderBy || []).map(desc => {
        return {
          column: table[desc.fieldName],
          orderBy: !desc.orderBy ? null : lf.Order[desc.orderBy]
        }
      })

      const matcher = {
        pk: {
          name: pk,
          queried: containKey
        },
        definition,
        mainTable: table
      }
      const { limit, skip } = clause
      const provider = new PredicateProvider(table, clause.where)

      return new Selector<T>(db, query, matcher, provider, limit, skip, orderDesc)
    })
  }

  private createColumn(
    tableBuilder: lf.schema.TableBuilder,
    columnName: string,
    rdbType: RDBType,
    nullable: string[],
    mapper: Map<string, Function>
  ): lf.schema.TableBuilder {
    const hiddenName = hiddenColName(columnName)

    switch (rdbType) {
      case RDBType.ARRAY_BUFFER:
        return tableBuilder.addColumn(columnName, lf.Type.ARRAY_BUFFER)
      case RDBType.BOOLEAN:
        return tableBuilder.addColumn(columnName, lf.Type.BOOLEAN)
      case RDBType.DATE_TIME:
        nullable.push(hiddenName)
        mapper.set(columnName, (val: string) => val ? new Date(val).valueOf() : new Date(0).valueOf())
        return tableBuilder
          .addColumn(columnName, lf.Type.INTEGER)
          .addColumn(hiddenName, lf.Type.STRING)
      case RDBType.INTEGER:
        return tableBuilder.addColumn(columnName, lf.Type.INTEGER)
      case RDBType.LITERAL_ARRAY:
        nullable.push(hiddenName)
        mapper.set(columnName, (val: any[]) => val ? val.join('|') : '')
        return tableBuilder
          .addColumn(columnName, lf.Type.STRING)
          .addColumn(hiddenName, lf.Type.OBJECT)
      case RDBType.NUMBER:
        return tableBuilder.addColumn(columnName, lf.Type.NUMBER)
      case RDBType.OBJECT:
        return tableBuilder.addColumn(columnName, lf.Type.OBJECT)
      case RDBType.STRING:
        return tableBuilder.addColumn(columnName, lf.Type.STRING)
      default:
        throw Exception.InvalidType()
    }
  }

  // context 用来标记DFS路径中的所有出现过的表，用于解决self-join时的二义性
  // path 用来标记每个查询路径上出现的表，用于解决circular reference
  private traverseQueryFields(
    db: lf.Database,
    tableName: string,
    fieldsValue: Set<Fields>,
    hasKey: boolean,
    glob: boolean,
    path: string[] = [],
    context: Record = {}
  ) {
    const schema = this.findSchema(tableName)
    const rootDefinition = Object.create(null)
    const navigators: string[] = []

    const columns: lf.schema.Column[] = []
    const joinInfo: JoinInfo[] = []

    if (contains(tableName, path)) { // thinking mode: implicit & explicit
      return { columns, joinInfo, advanced: false, table: null, definition: null }
    } else {
      path.push(tableName)
    }

    schema.associations.forEach((_, nav) => {
      if (glob && !contains(nav, path)) {
        fieldsValue.add(nav)
      }
      navigators.push(nav)
    })

    const onlyNavigator = Array.from(fieldsValue.keys())
      .every(key => contains(key, navigators))
    assert(!onlyNavigator, Exception.InvalidQuery())

    if (!hasKey) {
      fieldsValue.add(schema.pk)
    }

    const suffix = (context[tableName] || 0) + 1
    context[tableName] = suffix
    const contextName = contextTableName(tableName, suffix)
    const currentTable = Database.getTables(db, tableName)[0].as(contextName)

    const handleAdvanced = (ret: any, key: string, defs: Association | ColumnDef) => {
      if (!ret.advanced) {
        return
      }

      columns.push(...ret.columns)
      assert(!rootDefinition[key], Exception.AliasConflict(key, tableName))

      if ((defs as ColumnDef).column) {
        rootDefinition[key] = defs
      } else {
        const { where, type } = defs as Association
        rootDefinition[key] = definition.revise(type, ret.definition)
        const [ predicate, err ] = tryCatch(createPredicate)(currentTable, where(ret.table))
        if (err) {
          warn(
            `Failed to build predicate, since ${err.message}` +
            `, on table: ${ret.table.getName()}`
          )
        }
        const joinLink = predicate
          ? [{ table: ret.table, predicate }, ...ret.joinInfo]
          : ret.joinInfo

        joinInfo.push(...joinLink)
      }
    }

    const traversable = new Traversable<SelectContext>(fieldsValue)

    traversable.context((field, val, ctx) => {
      if (ctx.isRoot || typeof field !== 'string') {
        return false
      }

      const isNavigatorLeaf = contains(field, navigators)
      const type = isNavigatorLeaf ? LeafType.navigator : LeafType.column
      const key = ctx.key ? ctx.key : val

      if (isNavigatorLeaf) {
        const description = schema.associations.get(ctx.key)
        if (!description) {
          warn(`Build a relationship failed, field: ${ctx.key}.`)
          return false
        }

        return { type, key, leaf: this.navigatorLeaf(description, ctx.key, val) }
      }

      if (!currentTable[field]) {
        warn(`Column: ${field} is not exist on ${tableName}`)
        return false
      }

      return { type, key, leaf: this.columnLeaf(currentTable, contextName, field) }
    })

    traversable.forEach((ctx) => {
      switch (ctx.type) {
        case LeafType.column:
          const { column, identifier } = ctx.leaf as ColumnLeaf
          const type = schema.columns.get(ctx.key)
          const columnDef = definition.create(identifier, schema.pk === ctx.key, type)
          handleAdvanced({ columns: [column], advanced: true }, ctx.key, columnDef)
          break
        case LeafType.navigator:
          const { containKey, fields, assocaiation } = ctx.leaf as NavigatorLeaf
          const ret =
            this.traverseQueryFields(db, assocaiation.name, new Set(fields), containKey, glob, path.slice(0), context)
          handleAdvanced(ret, ctx.key, assocaiation)
          ctx.skip()
          break
      }
    })

    return { columns, joinInfo, advanced: true, table: currentTable, definition: rootDefinition }
  }

  private traverseCompound(
    db: lf.Database,
    tableName: string,
    compoundEntites: any,
    insertMutList: Mutation[],
    updateMutList: Mutation[],
    sharing: Map<string, Mutation>
  ) {
    if (Array.isArray(compoundEntites)) {
      compoundEntites.forEach((item) =>
        this.traverseCompound(db, tableName, item, insertMutList, updateMutList, sharing))
      return
    }

    const schema = this.findSchema(tableName)
    const pk = schema.pk
    const pkVal = compoundEntites[pk]
    assert(pkVal !== undefined, Exception.PrimaryKeyNotProvided())

    const [ table ] = Database.getTables(db, tableName)
    const identifier = fieldIdentifier(tableName, pkVal)
    const visited = contains(identifier, sharing)
    const stored =  contains(identifier, this.storedIds)
    const mut = visited ? sharing.get(identifier) : new Mutation(db, table)

    if (!visited) {
      const list = stored ? updateMutList : insertMutList
      list.push(mut)
      sharing.set(identifier, mut)
    }

    const traversable = new Traversable<UpsertContext>(compoundEntites)

    traversable.context((key, _, ctx) => {
      const isNavigator = schema.associations.has(key)
      const isColumn = schema.columns.has(key)
      const mapper = (isColumn && schema.mapper.get(key)) || null

      if (!(isColumn || isNavigator || ctx.isRoot)) {
        // 若当前节点非 有效节点、叶子节点或者根节点中任意一种时，直接停止子节点的迭代
        ctx.skip()
      }

      return (ctx.isRoot || (!isColumn && !isNavigator)) ? false : {
        mapper,
        visited,
        isNavigatorLeaf: isNavigator
      }
    })

    traversable.forEach((ctx, node) => {
      // 考虑到叶节点可能存在`Object` type， 所以无论分支节点还是叶节点，其后的结构都不迭代
      ctx.skip()
      if (ctx.isNavigatorLeaf) {
        const ref = schema.associations.get(ctx.key).name
        return this.traverseCompound(db, ref, node, insertMutList, updateMutList, sharing)
      }

      if (ctx.key !== pk) {
        // 如果字段不为主键
        const res = ctx.mapper ? {
          [ctx.key]: ctx.mapper(node),
          [hiddenColName(ctx.key)]: node
        } : { [ctx.key]: node }
        mut.patch(res)
      } else if (ctx.key === pk && !ctx.visited) {
        // 如果该字段为该表主键, 且该节点是第一次在过程中访问
        // i.e. sharing.has(identifier) is equl to false
        mut.withId(ctx.key, node)
      }
    })
  }

  private columnLeaf(table: lf.schema.Table, tableName: string, key: string) {
    const column = table[key]
    const hiddenName = hiddenColName(key)
    const identifier = fieldIdentifier(tableName, key)
    const hiddenCol = table[hiddenName]
    const ret = hiddenCol ? hiddenCol.as(identifier) : column.as(identifier)

    return {
      identifier,
      column: ret
    }
  }

  private navigatorLeaf(assocaiation: Association, _: string, val: any) {
    const schema = this.findSchema(assocaiation.name)
    const fields = typeof val === 'string'
      ? new Set(schema.columns.keys())
      : val

    return {
      fields,
      assocaiation,
      containKey: contains(schema.pk, val)
    }
  }

  private createScopedHandler<T>(db: lf.Database, queryCollection: any[], keys: any[]) {
    return (tableName: string): ScopedHandler => {
      const pk = this.findPrimaryKey(tableName)

      const remove = (entities: T[]) => {
        const [ table ] = Database.getTables(db, tableName)
        entities.forEach(entity => {
          const pkVal = entity[pk]
          const clause = createPkClause(pk, pkVal)
          const predicate = createPredicate(table, clause)
          const query = predicatableQuery(db, table, predicate, StatementType.Delete)

          queryCollection.push(query)
          keys.push(fieldIdentifier(tableName, pkVal))
        })
      }

      const get = (where: Predicate<any> = null) => {
        const [ table ] = Database.getTables(db, tableName)
        const [ predicate, err ] = tryCatch(createPredicate)(table, where)
        if (err) {
          return Observable.throw(err)
        }
        const query = predicatableQuery(db, table, predicate, StatementType.Select)

        return Observable.fromPromise<T[]>(query.exec())
      }

      return [get, remove]
    }
  }

  private executor(db: lf.Database, queries: lf.query.Builder[]) {
    const tx = db.createTransaction()
    const handler = {
      error: () => warn(`Execute failed, transaction is already marked for rollback.`)
    }

    return Observable.fromPromise(tx.exec(queries))
      .do(handler)
      .map((ret) => {
        return {
          result: true,
          ...mergeTransactionResult(queries, ret)
        }
      })
  }

}
