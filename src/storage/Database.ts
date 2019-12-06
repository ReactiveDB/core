import { throwError, ConnectableObservable, Observable, Subscription, from, of as just } from 'rxjs'
import { concatMap, map, tap } from 'rxjs/operators'
import * as lf from 'lovefield'
import * as Exception from '../exception'
import * as typeDefinition from './helper/definition'
import Version from '../version'
import { Traversable } from '../shared'
import { Mutation, Selector, QueryToken, PredicateProvider } from './modules'
import { dispose, contextTableName, fieldIdentifier, hiddenColName } from './symbols'
import {
  forEach,
  clone,
  contains,
  tryCatch,
  isException,
  hasOwn,
  getType,
  assert,
  assertValue,
  warn,
  isNonNullable,
} from '../utils'
import { createPredicate, createPkClause, mergeTransactionResult, predicatableQuery, lfFactory } from './helper'
import { Relationship, RDBType, DataStoreType, LeafType, StatementType, JoinMode } from '../interface/enum'
import { SchemaDef, ColumnDef, ParsedSchema, Association, ScopedHandler } from '../interface'
import { ColumnLeaf, NavigatorLeaf, ExecutorResult, UpsertContext, SelectContext } from '../interface'
import {
  Record,
  Field,
  JoinInfo,
  Query,
  Clause,
  Predicate,
  Transaction,
  TransactionDescriptor,
  TransactionEffects,
} from '../interface'

const transactionErrorHandler = {
  error: () => warn(`Execute failed, transaction is already marked for rollback.`),
}

const tryCatchCreatePredicate = tryCatch(createPredicate)

export class Database {
  public static version = Version

  public static getTables(db: lf.Database, ...tableNames: string[]) {
    return tableNames.map((name) => db.getSchema().table(name))
  }

  public readonly database$: ConnectableObservable<lf.Database>
  public readonly inTransaction: boolean = false

  private schemaDefs = new Map<string, SchemaDef<any>>()
  private schemas = new Map<string, ParsedSchema>()
  private schemaBuilder: lf.schema.Builder | null
  private connected = false
  // note thin cache will be unreliable in some eage case
  private storedIds = new Set<string>()
  private subscription: Subscription | null = null

  private findSchema = (name: string): ParsedSchema => {
    const schema = this.schemas.get(name)
    assertValue(schema, Exception.NonExistentTable, name)
    return schema
  }
  private tryCatchFindPrimaryKey = tryCatch((name: string) => {
    return this.findSchema(name).pk
  })
  private tryCatchFindSchema = tryCatch(this.findSchema)

  /**
   * @method defineSchema
   * @description 定义数据表的 metadata, 通过ReactiveDB查询时会根据这些 metadata 决定如何处理关联数据
   */
  defineSchema<T>(tableName: string, schema: SchemaDef<T>) {
    const advanced = !this.schemaDefs.has(tableName) && !this.connected
    assert(advanced, Exception.UnmodifiableTable)

    const hasPK = Object.keys(schema).some((key: string) => schema[key].primaryKey === true)
    assert(hasPK, Exception.PrimaryKeyNotProvided, { tableName })

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
    version = 1,
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
    const dump = (db: lf.Database) => db.export()
    return this.database$.pipe(concatMap(dump))
  }

  load(data: any) {
    assert(!this.connected, Exception.DatabaseIsNotEmpty)

    const load = (db: lf.Database) => {
      const findPrimaryKey = this.tryCatchFindPrimaryKey({ call: 'load', doThrow: true })
      forEach(data.tables, (entities: any[], name: string) => {
        const { unwrapped: pk } = findPrimaryKey(name)
        entities.forEach((entity: any) => this.storedIds.add(fieldIdentifier(name, entity[pk])))
      })
      return db.import(data).catch(() => {
        forEach(data.tables, (entities: any[], name: string) => {
          const { unwrapped: pk } = findPrimaryKey(name)
          entities.forEach((entity: any) => this.storedIds.delete(fieldIdentifier(name, entity[pk])))
        })
      })
    }
    return this.database$.pipe(concatMap(load))
  }

  insert<T>(tableName: string, raw: T[]): Observable<ExecutorResult>

  insert<T>(tableName: string, raw: T): Observable<ExecutorResult>

  insert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult>

  insert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult> {
    const insert = (db: lf.Database) => {
      const maybeSchema = this.tryCatchFindSchema({ op: 'insert' })(tableName)
      if (isException(maybeSchema)) {
        return throwError(maybeSchema.unwrapped)
      }
      const schema = maybeSchema.unwrapped
      const pk = schema.pk
      const columnMapper = schema.mapper
      const [table] = Database.getTables(db, tableName)
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
      contextIds.forEach((id) => this.storedIds.add(id))
      const onError = { error: () => contextIds.forEach((id) => this.storedIds.delete(id)) }

      if (this.inTransaction) {
        this.attachTx(onError)
        return this.executor(db, queries)
      }

      return this.executor(db, queries).pipe(tap(onError))
    }
    return this.database$.pipe(concatMap(insert))
  }

  get<T>(tableName: string, query: Query<T> = {}, mode: JoinMode = JoinMode.imlicit): QueryToken<T> {
    const selector$ = this.database$.pipe(map((db) => this.buildSelector(db, tableName, query, mode)))
    return new QueryToken<T>(selector$)
  }

  update<T>(tableName: string, clause: Predicate<T>, raw: Partial<T>): Observable<ExecutorResult> {
    const type = getType(raw)
    if (type !== 'Object') {
      return throwError(Exception.InvalidType(['Object', type]))
    }

    const maybeSchema = this.tryCatchFindSchema({ op: 'update' })(tableName)
    if (isException(maybeSchema)) {
      return throwError(maybeSchema.unwrapped)
    }
    const schema = maybeSchema.unwrapped

    const update = (db: lf.Database) => {
      const entity = clone(raw)
      const [table] = Database.getTables(db, tableName)
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
      const predicate = createPredicate(table, clause)
      const query = predicatableQuery(db, table, predicate!, StatementType.Update)

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
    }
    return this.database$.pipe(concatMap(update))
  }

  delete<T>(tableName: string, clause: Predicate<T> = {}): Observable<ExecutorResult> {
    const maybePK = this.tryCatchFindPrimaryKey({ op: 'delete' })(tableName)
    if (isException(maybePK)) {
      return throwError(maybePK.unwrapped)
    }
    const pk = maybePK.unwrapped

    const deletion = (db: lf.Database): Observable<ExecutorResult> => {
      const [table] = Database.getTables(db, tableName)
      const column = table[pk]
      const provider = new PredicateProvider(table, clause)
      const prefetch = predicatableQuery(db, table, provider.getPredicate(), StatementType.Select, column)
      const deleteByScopedIds = (scopedIds: Object[]) => {
        const query = predicatableQuery(db, table, provider.getPredicate(), StatementType.Delete)

        scopedIds.forEach((entity) => this.storedIds.delete(fieldIdentifier(tableName, entity[pk])))

        const onError = {
          error: () => {
            scopedIds.forEach((entity: object) => this.storedIds.add(fieldIdentifier(tableName, entity[pk])))
          },
        }

        if (this.inTransaction) {
          this.attachTx(onError)
          return this.executor(db, [query])
        }

        return this.executor(db, [query]).pipe(tap(onError))
      }

      return from(prefetch.exec()).pipe(concatMap(deleteByScopedIds))
    }

    return this.database$.pipe(concatMap(deletion))
  }

  upsert<T>(tableName: string, raw: T): Observable<ExecutorResult>

  upsert<T>(tableName: string, raw: T[]): Observable<ExecutorResult>

  upsert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult>

  upsert<T>(tableName: string, raw: T | T[]): Observable<ExecutorResult> {
    const upsert = (db: lf.Database) => {
      const sharing = new Map<any, Mutation>()
      const insert: Mutation[] = []
      const update: Mutation[] = []

      this.traverseCompound(db, tableName, clone(raw), insert, update, sharing)
      const { contextIds, queries } = Mutation.aggregate(db, insert, update)
      if (queries.length > 0) {
        contextIds.forEach((id) => this.storedIds.add(id))
        const onError = { error: () => contextIds.forEach((id) => this.storedIds.delete(id)) }

        if (this.inTransaction) {
          this.attachTx(onError)
          return this.executor(db, queries)
        }

        return this.executor(db, queries).pipe(tap(onError))
      } else {
        return just({ result: false, insert: 0, update: 0, delete: 0, select: 0 })
      }
    }
    return this.database$.pipe(concatMap(upsert))
  }

  remove<T>(tableName: string, clause: Clause<T> = {}): Observable<ExecutorResult> {
    const maybeSchema = this.tryCatchFindSchema({ op: 'remove' })(tableName)
    if (isException(maybeSchema)) {
      return throwError(maybeSchema.unwrapped)
    }
    const schema = maybeSchema.unwrapped
    const disposeHandler = schema.dispose

    const remove = (db: lf.Database) => {
      const [table] = Database.getTables(db, tableName)
      const predicate = createPredicate(table, clause.where)

      const queries: lf.query.Builder[] = []
      const removedIds: any = []
      queries.push(predicatableQuery(db, table, predicate!, StatementType.Delete))

      const removeByRootEntities = (rootEntities: Object[]) => {
        rootEntities.forEach((entity) => {
          removedIds.push(fieldIdentifier(tableName, entity[schema.pk]))
        })

        const onError = {
          error: () => removedIds.forEach((id: string) => this.storedIds.add(id)),
        }

        if (disposeHandler) {
          const scope = this.createScopedHandler<T>(db, queries, removedIds)
          return disposeHandler(rootEntities, scope).pipe(
            tap(() => removedIds.forEach((id: string) => this.storedIds.delete(id))),
            concatMap(() => {
              if (this.inTransaction) {
                this.attachTx(onError)
                return this.executor(db, queries)
              }
              return this.executor(db, queries).pipe(tap(onError))
            }),
          )
        } else {
          removedIds.forEach((id: string) => this.storedIds.delete(id))
          if (this.inTransaction) {
            this.attachTx(onError)
            return this.executor(db, queries)
          }
          return this.executor(db, queries).pipe(tap(onError))
        }
      }

      const prefetch = predicatableQuery(db, table, predicate!, StatementType.Select)
      return from(prefetch.exec()).pipe(concatMap(removeByRootEntities))
    }

    return this.database$.pipe(concatMap(remove))
  }

  dispose(): Observable<never> | Observable<ExecutorResult> {
    if (!this.connected) {
      return throwError(Exception.NotConnected())
    }

    const cleanUp = (db: lf.Database) => {
      const deletions = db
        .getSchema()
        .tables()
        .map((t) => db.delete().from(t))
      return this.executor(db, deletions).pipe(
        tap(() => {
          db.close()
          this.schemas.clear()
          this.storedIds.clear()
          this.schemaBuilder = null
          this.subscription!.unsubscribe()
        }),
      )
    }

    return this.database$.pipe(concatMap(cleanUp))
  }

  attachTx(_: TransactionEffects) {
    throw Exception.UnexpectedTransactionUse()
  }

  executor(db: lf.Database, queries: lf.query.Builder[]) {
    const tx = db.createTransaction()

    return from(tx.exec(queries)).pipe(
      tap(transactionErrorHandler),
      map((ret) => {
        return {
          result: true,
          ...mergeTransactionResult(queries, ret),
        }
      }),
    )
  }

  transaction(): Observable<Transaction<Database>> {
    type ProxyProperty = Pick<Database, 'attachTx' | 'executor' | 'inTransaction'>

    return this.database$.pipe(
      map((db) => {
        const tx = db.createTransaction()
        const transactionQueries: lf.query.Builder[] = []
        const effects: TransactionEffects[] = []

        const transactionContext: TransactionDescriptor<ProxyProperty> = {
          attachTx: {
            get() {
              return (handler: TransactionEffects) => {
                effects.push(handler)
              }
            },
          },
          executor: {
            get() {
              return (_: lf.Database, queries: lf.query.Builder[]) => {
                transactionQueries.push(...queries)
                return just(null)
              }
            },
          },
          inTransaction: {
            get() {
              return true
            },
          },
        }

        const customTx = {
          commit: () => {
            return effects
              .reduce((acc, curr) => {
                return acc.pipe(tap(curr))
              }, from(tx.exec(transactionQueries)))
              .pipe(
                map((r) => {
                  return {
                    result: true,
                    ...mergeTransactionResult(transactionQueries, r),
                  }
                }),
              )
          },
          abort: () => {
            effects.length = 0
            transactionQueries.length = 0
          },
        }

        const ret: Transaction<Database> = [Object.create(this, transactionContext), customTx]

        return ret
      }),
    )
  }

  private buildTables() {
    this.schemaDefs.forEach((schemaDef, tableName) => {
      const tableBuilder = this.schemaBuilder!.createTable(tableName)
      this.parseSchemaDef(tableName, schemaDef, tableBuilder)
    })
  }

  /**
   * 解析 schemaDefs, 根据解析后的 metadata 建表
   */
  private parseSchemaDef(tableName: string, schemaDef: SchemaDef<any>, tableBuilder: lf.schema.TableBuilder) {
    const uniques: string[] = []
    const indexes: string[] = []
    const primaryKey: string[] = []
    const nullable: string[] = []
    const columns = new Map<string, RDBType>()
    const associations = new Map<string, Association>()
    const mapper = new Map<string, Function>()
    const disposeHandler =
      (typeof schemaDef.dispose === 'function' && schemaDef.dispose) ||
      (typeof schemaDef[dispose] === 'function' && schemaDef[dispose]) ||
      undefined

    // src: schemaDef; dest: uniques, indexes, primaryKey, nullable, associations, mapper
    // no short-curcuiting
    forEach(schemaDef, (def, key) => {
      const currentPK: string | undefined = primaryKey[0]

      if (typeof def === 'function') {
        return
      }

      if (!def.virtual) {
        this.createColumn(tableBuilder, key, def.type as RDBType, nullable, mapper)
        columns.set(key, def.type as RDBType)

        if (def.primaryKey) {
          assert(!currentPK, Exception.PrimaryKeyConflict, { tableName, currentPK, incomingPK: key })
          primaryKey.push(key)
        }

        if (def.unique) {
          uniques.push(key)
        }

        if (def.index) {
          indexes.push(key)
        }

        const isNullable = ![def.primaryKey, def.index, def.unique].some(isNonNullable)
        if (isNullable) {
          nullable.push(key)
        }
      } else {
        associations.set(key, {
          where: def.virtual.where,
          type: def.type as Relationship,
          name: def.virtual.name,
        })
      }
    })

    this.schemas.set(tableName, {
      pk: primaryKey[0],
      mapper,
      columns,
      dispose: disposeHandler,
      associations,
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

  private buildSelector<T>(db: lf.Database, tableName: string, clause: Query<T>, mode: JoinMode) {
    const { unwrapped: schema } = this.tryCatchFindSchema({
      call: 'buildSelector',
      doThrow: true,
    })(tableName)
    const pk = schema.pk
    const containFields = !!clause.fields

    const containKey = containFields ? contains(pk, clause.fields!) : true
    const fields: Set<Field> = containFields ? new Set(clause.fields) : new Set(schema.columns.keys())
    const { table, columns, joinInfo, definition } = this.traverseQueryFields(
      db,
      tableName,
      fields,
      containKey,
      !containFields,
      [],
      {},
      mode,
    )
    const query = predicatableQuery(db, table!, null, StatementType.Select, ...columns)

    joinInfo.forEach((info: JoinInfo) => query.leftOuterJoin(info.table, info.predicate))

    const orderDesc = (clause.orderBy || []).map((desc) => {
      return {
        column: table![desc.fieldName],
        orderBy: !desc.orderBy ? null : lf.Order[desc.orderBy],
      }
    })

    const matcher = {
      pk: {
        name: pk,
        queried: containKey,
      },
      definition,
      mainTable: table!,
    }
    const { limit, skip } = clause
    const provider = new PredicateProvider(table!, clause.where)

    return new Selector<T>(db, query, matcher, provider, limit, skip, orderDesc)
  }

  private createColumn(
    tableBuilder: lf.schema.TableBuilder,
    columnName: string,
    rdbType: RDBType,
    nullable: string[],
    mapper: Map<string, Function>,
  ): lf.schema.TableBuilder {
    const hiddenName = hiddenColName(columnName)

    switch (rdbType) {
      case RDBType.ARRAY_BUFFER:
        return tableBuilder.addColumn(columnName, lf.Type.ARRAY_BUFFER)
      case RDBType.BOOLEAN:
        return tableBuilder.addColumn(columnName, lf.Type.BOOLEAN)
      case RDBType.DATE_TIME:
        nullable.push(hiddenName)
        mapper.set(columnName, (val: string) => (val ? new Date(val).valueOf() : new Date(0).valueOf()))
        return tableBuilder.addColumn(columnName, lf.Type.INTEGER).addColumn(hiddenName, lf.Type.STRING)
      case RDBType.INTEGER:
        return tableBuilder.addColumn(columnName, lf.Type.INTEGER)
      case RDBType.LITERAL_ARRAY:
        nullable.push(hiddenName)
        mapper.set(columnName, (val: any[]) => (val ? val.join('|') : ''))
        return tableBuilder.addColumn(columnName, lf.Type.STRING).addColumn(hiddenName, lf.Type.OBJECT)
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
    fieldsValue: Set<Field>,
    hasKey: boolean,
    glob: boolean,
    path: string[] = [],
    context: Record = {},
    mode: JoinMode,
  ) {
    const { unwrapped: schema } = this.tryCatchFindSchema({
      call: 'traverseQueryFields',
      doThrow: true,
    })(tableName)
    const rootDefinition = Object.create(null)
    const navigators: string[] = []

    const columns: lf.schema.Column[] = []
    const joinInfo: JoinInfo[] = []

    if (mode === JoinMode.imlicit && contains(tableName, path)) {
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

    const onlyNavigator = Array.from(fieldsValue.keys()).every((key) => contains(key, navigators))
    assert(!onlyNavigator, Exception.InvalidQuery)

    if (!hasKey) {
      // 保证主键一定比关联字段更早的被遍历到
      const fields = Array.from(fieldsValue)
      fields.unshift(schema.pk)
      fieldsValue = new Set(fields)
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
      assert(!rootDefinition[key], Exception.AliasConflict, key, tableName)

      if ((defs as ColumnDef).column) {
        rootDefinition[key] = defs
      } else {
        const { where, type } = defs as Association
        rootDefinition[key] = typeDefinition.revise(type!, ret.definition)
        const maybePredicate = tryCatchCreatePredicate({
          tableName: ret.table.getName(),
        })(currentTable, where(ret.table))
        if (isException(maybePredicate)) {
          warn(`Failed to build predicate, since ${maybePredicate.unwrapped.message}`)
        }
        const predicate = maybePredicate.unwrapped
        const joinLink = predicate ? [{ table: ret.table, predicate }, ...ret.joinInfo] : ret.joinInfo

        joinInfo.push(...joinLink)
      }
    }

    const traversable = new Traversable<SelectContext>(fieldsValue)

    traversable.context((field, val, ctx) => {
      if (!ctx || ctx.isRoot || typeof field !== 'string') {
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
          const type = schema.columns.get(ctx.key)!
          const columnDef = typeDefinition.create(identifier, schema.pk === ctx.key, type)
          handleAdvanced({ columns: [column], advanced: true }, ctx.key, columnDef)
          break
        case LeafType.navigator:
          const { containKey, fields, assocaiation } = ctx.leaf as NavigatorLeaf
          const ret = this.traverseQueryFields(
            db,
            assocaiation.name,
            new Set(fields),
            containKey,
            glob,
            path.slice(0),
            context,
            mode,
          )
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
    sharing: Map<string, Mutation>,
  ) {
    if (compoundEntites == null) {
      return
    }
    if (Array.isArray(compoundEntites)) {
      compoundEntites.forEach((item) =>
        this.traverseCompound(db, tableName, item, insertMutList, updateMutList, sharing),
      )
      return
    }

    const { unwrapped: schema } = this.tryCatchFindSchema({
      call: 'traverseCompound',
      doThrow: true,
    })(tableName)
    const pk = schema.pk
    const pkVal = compoundEntites[pk]
    assert(pkVal !== undefined, Exception.PrimaryKeyNotProvided, { tableName, pk, entry: compoundEntites })

    const [table] = Database.getTables(db, tableName)
    const identifier = fieldIdentifier(tableName, pkVal)
    const visited = contains(identifier, sharing)
    const stored = contains(identifier, this.storedIds)
    const mut = visited ? sharing.get(identifier)! : new Mutation(db, table)

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

      if (!(isColumn || isNavigator || ctx!.isRoot)) {
        // 若当前节点非 有效节点、叶子节点或者根节点中任意一种时，直接停止子节点的迭代
        ctx!.skip()
      }

      return ctx!.isRoot || (!isColumn && !isNavigator)
        ? false
        : {
            mapper,
            visited,
            isNavigatorLeaf: isNavigator,
          }
    })

    traversable.forEach((ctx, node) => {
      // 考虑到叶节点可能存在`Object` type， 所以无论分支节点还是叶节点，其后的结构都不迭代
      ctx.skip()
      if (ctx.isNavigatorLeaf) {
        const ref = schema.associations.get(ctx.key)!.name
        return this.traverseCompound(db, ref, node, insertMutList, updateMutList, sharing)
      }

      if (ctx.key !== pk) {
        // 如果字段不为主键
        const res = ctx.mapper
          ? {
              [ctx.key]: ctx.mapper(node),
              [hiddenColName(ctx.key)]: node,
            }
          : { [ctx.key]: node }
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
      column: ret,
    }
  }

  private navigatorLeaf(assocaiation: Association, _: string, val: any) {
    const { unwrapped: schema } = this.tryCatchFindSchema({
      call: 'navigatorLeaf',
      doThrow: true,
    })(assocaiation.name)
    const fields = typeof val === 'string' ? new Set(schema.columns.keys()) : val

    return {
      fields,
      assocaiation,
      containKey: contains(schema.pk, val),
    }
  }

  private createScopedHandler<T>(db: lf.Database, queryCollection: any[], keys: any[]) {
    return (tableName: string): ScopedHandler => {
      const { unwrapped: pk } = this.tryCatchFindPrimaryKey({
        call: 'createScopedHandler',
        doThrow: true,
      })(tableName)

      const remove = (entities: T[]) => {
        const [table] = Database.getTables(db, tableName)
        entities.forEach((entity) => {
          const pkVal = entity[pk]
          const clause = createPkClause(pk, pkVal)
          const predicate = createPredicate(table, clause)
          const query = predicatableQuery(db, table, predicate!, StatementType.Delete)

          queryCollection.push(query)
          keys.push(fieldIdentifier(tableName, pkVal))
        })
      }

      const get = (where: Predicate<any> | null = null) => {
        const [table] = Database.getTables(db, tableName)
        const maybePredicate = tryCatchCreatePredicate({
          call: 'createScopedHandler',
        })(table, where)
        if (isException(maybePredicate)) {
          return throwError(maybePredicate.unwrapped)
        }
        const predicate = maybePredicate.unwrapped
        const query = predicatableQuery(db, table, predicate, StatementType.Select)

        return from<T[]>(query.exec() as any)
      }

      return [get, remove]
    }
  }
}
