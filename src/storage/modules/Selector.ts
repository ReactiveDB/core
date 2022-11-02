import { Observable, OperatorFunction, concat, from, asyncScheduler } from 'rxjs'
import {
  combineAll,
  debounceTime,
  map,
  mergeMap,
  publishReplay,
  reduce,
  refCount,
  startWith,
  switchMap,
} from 'rxjs/operators'
import * as lf from 'lovefield'
import * as Exception from '../../exception'
import { predicatableQuery, graph } from '../helper'
import { identity, forEach, assert, warn } from '../../utils'
import { PredicateProvider } from './PredicateProvider'
import { ShapeMatcher, OrderInfo, StatementType } from '../../interface'
import { mapFn } from './mapFn'

const observeQuery = (db: lf.Database, query: lf.query.Select) => {
  return new Observable<void>((observer) => {
    const listener = () => observer.next()
    db.observe(query, listener)
    return () => db.unobserve(query, listener)
  })
}

export class Selector<T> {
  private static concatFactory<U>(...metaDatas: Selector<U>[]) {
    const [meta] = metaDatas
    const skipsAndLimits = metaDatas.map((m) => ({ skip: m.skip, limit: m.limit })).sort((x, y) => x.skip! - y.skip!)
    const { db, lselect, shape, predicateProvider } = meta
    const [minSkip] = skipsAndLimits
    const maxLimit = skipsAndLimits.reduce((acc, current) => {
      const nextSkip = acc.skip! + acc.limit!
      assert(
        current.skip === nextSkip,
        Exception.TokenConcatFailed,
        `
        skip should be serial,
        expect: ${JSON.stringify(acc, null, 2)}
        actual: ${nextSkip}
      `,
      )
      return current
    })
    return new Selector(
      db,
      lselect,
      shape,
      predicateProvider,
      maxLimit.limit! + maxLimit.skip!,
      minSkip.skip,
      meta.orderDescriptions,
    ).map<U>(meta.mapFn)
  }

  private static combineFactory<U>(...metaDatas: Selector<U>[]) {
    const [originalToken] = metaDatas
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, {} as any)
    dist.change$ = from(metaDatas).pipe(
      map((metas) => metas.mapFn(metas.change$)),
      combineAll<U[]>(),
      map((r) => r.reduce((acc, val) => acc.concat(val))),
      debounceTime(0, asyncScheduler),
      publishReplay(1),
      refCount(),
    )
    dist.values = () => {
      assert(!dist.consumed, Exception.TokenConsumed)
      dist.consumed = true
      return from(metaDatas).pipe(
        mergeMap((metaData) => metaData.values()),
        reduce((acc, val) => acc.concat(val)),
      )
    }
    dist.toString = () => {
      const querys = metaDatas.map((m) => m.toString())
      return JSON.stringify(querys, null, 2)
    }
    dist.select = originalToken.select
    return dist
  }

  private static stringifyOrder(orderInfo: OrderInfo[]) {
    if (!orderInfo) {
      return 0
    }
    let orderStr = ''
    forEach(orderInfo, (order) => {
      const name = order.column.getName()
      const o = order.orderBy
      orderStr += `${name}:${o}`
    })
    return orderStr
  }

  private mapFn: (stream$: Observable<T[]>) => Observable<any[]> = mapFn

  public select: string

  private _change$: Observable<T[]> | null = null

  private get change$(): Observable<T[]> {
    if (this._change$) {
      return this._change$
    }
    const { db, limit } = this
    let { skip } = this
    skip = limit && !skip ? 0 : skip

    const observeOn = (query: lf.query.Select) => {
      const queryOnce = () => from(this.getValue(query))
      // 下面的语句针对两个 lovefield issue 做了特殊调整：
      // issue#209: 确保 db.observe 之后立即执行一次查询；
      // issue#215: 确保 db.observe “不正确地”立即调用回调的行为，不会给消费方造成初始的重复推送。
      return observeQuery(db, query).pipe(startWith(void 0), switchMap(queryOnce))
    }

    const changesOnQuery =
      limit || skip
        ? this.buildPrefetchingObserve().pipe(switchMap((pks) => observeOn(this.getQuery(this.inPKs(pks)))))
        : observeOn(this.getQuery())

    return changesOnQuery.pipe(publishReplay(1), refCount())
  }

  private set change$(dist$: Observable<T[]>) {
    this._change$ = dist$
  }

  private consumed = false
  private predicateBuildErr = false

  private get rangeQuery(): lf.query.Select {
    let predicate: lf.Predicate | null = null
    const { predicateProvider } = this
    if (predicateProvider && !this.predicateBuildErr) {
      predicate = predicateProvider.getPredicate()
    }
    const { pk, mainTable } = this.shape

    const column = mainTable[pk.name]
    const rangeQuery = predicatableQuery(this.db, mainTable, predicate, StatementType.Select, column)

    if (this.orderDescriptions && this.orderDescriptions.length) {
      forEach(this.orderDescriptions, (orderInfo) => rangeQuery.orderBy(orderInfo.column, orderInfo.orderBy!))
    }

    rangeQuery.limit(this.limit!).skip(this.skip!)

    return rangeQuery
  }

  private get query(): lf.query.Select {
    const q = this.lselect.clone()

    if (this.orderDescriptions && this.orderDescriptions.length) {
      forEach(this.orderDescriptions, (orderInfo) => q.orderBy(orderInfo.column, orderInfo.orderBy!))
    }

    return q
  }

  // returns the given PredicateProvider if it is not 'empty';
  // otherwise, returns undefined
  private normPredicateProvider(pp?: PredicateProvider<T>): PredicateProvider<T> | undefined {
    try {
      return pp && pp.getPredicate() ? pp : undefined
    } catch (err) {
      this.predicateBuildErr = true
      warn(`Failed to build predicate, since ${err.message}` + `, on table: ${this.shape.mainTable.getName()}`)
      return undefined
    }
  }

  constructor(
    public db: lf.Database,
    private lselect: lf.query.Select,
    private shape: ShapeMatcher,
    public predicateProvider?: PredicateProvider<T>,
    private limit?: number,
    private skip?: number,
    private orderDescriptions?: OrderInfo[],
  ) {
    this.predicateProvider = this.normPredicateProvider(predicateProvider)
    this.select = lselect.toSql()
  }

  toString(): string {
    return this.getQuery().toSql()
  }

  values(): Observable<T[]> | never {
    if (typeof this.limit !== 'undefined' || typeof this.skip !== 'undefined') {
      const p = this.rangeQuery
        .exec()
        .then((r) => r.map((v) => v[this.shape.pk.name]))
        .then((pks) => this.getValue(this.getQuery(this.inPKs(pks))))
      return this.mapFn(from(p))
    } else {
      return this.mapFn(from(this.getValue(this.getQuery()) as Promise<T[]>))
    }
  }

  combine(...selectors: Selector<T>[]): Selector<T> {
    return Selector.combineFactory(this, ...selectors)
  }

  concat(...selectors: Selector<T>[]): Selector<T> {
    const orderStr = Selector.stringifyOrder(this.orderDescriptions!)
    const equal = selectors.every(
      (m) =>
        m.select === this.select &&
        Selector.stringifyOrder(m.orderDescriptions!) === orderStr &&
        m.mapFn.toString() === this.mapFn.toString() &&
        (m.predicateProvider === this.predicateProvider ||
          (!!(m.predicateProvider && this.predicateProvider) &&
            m.predicateProvider!.toString() === this.predicateProvider!.toString())),
    )
    assert(equal, Exception.TokenConcatFailed)

    return Selector.concatFactory(this, ...selectors)
  }

  changes(): Observable<T[]> | never {
    return this.mapFn(this.change$)
  }

  map<K>(fn: OperatorFunction<T[], K[]>) {
    this.mapFn = fn
    return (this as any) as Selector<K>
  }

  private inPKs(pks: (string | number)[]): lf.Predicate {
    const { pk, mainTable } = this.shape
    return mainTable[pk.name].in(pks)
  }

  private getValue(query: lf.query.Select) {
    return query.exec().then((rows: any[]) => {
      const result = graph<T>(rows, this.shape.definition)
      const col = this.shape.pk.name
      return !this.shape.pk.queried ? this.removeKey(result, col) : result
    })
  }

  private getQuery(additional?: lf.Predicate): lf.query.Select {
    if (this.predicateBuildErr) {
      return additional ? this.query.where(additional) : this.query
    }
    // !this.predicateBuildErr

    const preds: lf.Predicate[] = []
    if (this.predicateProvider) {
      preds.push(this.predicateProvider.getPredicate()!)
    }
    if (additional) {
      preds.push(additional)
    }

    switch (preds.length) {
      case 0:
        return this.query
      case 1:
        return this.query.where(preds[0])
      default:
        return this.query.where(lf.op.and(...preds))
    }
  }

  private removeKey(data: any[], key: string) {
    data.forEach((entity) => delete entity[key])
    return data
  }

  private buildPrefetchingObserve(): Observable<(string | number)[]> {
    const { rangeQuery } = this
    const queryOnce = () => from(rangeQuery.exec())
    const update$ = observeQuery(this.db, rangeQuery).pipe(switchMap(queryOnce))
    return concat(queryOnce(), update$).pipe(map((r) => r.map((v) => v[this.shape.pk.name])))
  }
}
