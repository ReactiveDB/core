import { Observer } from 'rxjs/Observer'
import { Observable } from 'rxjs/Observable'
import { async } from 'rxjs/scheduler/async'
import * as lf from 'lovefield'
import * as Exception from '../../exception'
import { predicatableQuery, graph } from '../helper'
import { identity, forEach, assert, warn } from '../../utils'
import { PredicateProvider } from './PredicateProvider'
import { ShapeMatcher, OrderInfo, StatementType } from '../../interface'
import { mapFn } from './mapFn'

export class Selector <T> {
  private static concatFactory<U>(...metaDatas: Selector<U>[]) {
    const [ meta ] = metaDatas
    const skipsAndLimits = metaDatas
      .map(m => ({ skip: m.skip, limit: m.limit }))
      .sort((x, y) => x.skip! - y.skip!)
    const { db, lselect, shape, predicateProvider } = meta
    const [ minSkip ] = skipsAndLimits
    const maxLimit = skipsAndLimits.reduce((acc, current) => {
      const nextSkip = acc.skip! + acc.limit!
      assert(current.skip === nextSkip, () => Exception.TokenConcatFailed(`
        skip should be serial,
        expect: ${JSON.stringify(acc, null, 2)}
        actual: ${nextSkip}
      `))
      return current
    })
    return new Selector(
      db, lselect, shape, predicateProvider,
      maxLimit.limit! + maxLimit.skip!, minSkip.skip, meta.orderDescriptions
    )
      .map<U>(meta.mapFn)
  }

  private static combineFactory<U>(... metaDatas: Selector<U>[]) {
    const [ originalToken ] = metaDatas
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, { } as any)
    dist.change$ = Observable.from(metaDatas)
      .map(metas => metas.mapFn(metas.change$))
      .combineAll<any, any>()
      .map((r: U[][]) => r.reduce((acc, val) => acc.concat(val)))
      .debounceTime(0, async)
      .publishReplay(1)
      .refCount()
    dist.values = () => {
      assert(!dist.consumed, () => Exception.TokenConsumed())
      dist.consumed = true
      return Observable.from(metaDatas)
        .flatMap(metaData => metaData.values())
        .reduce((acc: U[], val: U[]) => acc.concat(val))
    }
    dist.toString = () => {
      const querys = metaDatas.map(m => m.toString())
      return JSON.stringify(querys, null, 2)
    }
    dist.select = originalToken.select
    return dist
  }

  private static stringifyOrder(orderInfo: OrderInfo[], ) {
    if (!orderInfo) {
      return 0
    }
    let orderStr = ''
    forEach(orderInfo, order => {
      const name = order.column.getName()
      const o = order.orderBy
      orderStr += `${name}:${o}`
    })
    return orderStr
  }

  private mapFn: (stream$: Observable<T[]>) => Observable<any[]> = mapFn

  public select: string

  private _change$: Observable<T[]> | null = null

  private get change$ (): Observable<T[]> {
    if (this._change$) {
      return this._change$
    }
    const { db, limit } = this
    let { skip } = this
    skip = limit && !skip ? 0 : skip

    const observeOn = (query: lf.query.Select) =>
      Observable.create((observer: Observer<T[]>) => {
        const listener = () => {
          this.getValue(query)
            .then(r => observer.next(r as T[]))
            .catch(e => observer.error(e))
        }
        db.observe(query, listener)
        listener()
        return () => this.db.unobserve(query, listener)
      }) as Observable<T[]>

    const changesOnQuery = limit || skip
      ? this.buildPrefetchingObserve()
        .switchMap((pks) =>
          observeOn(this.getQuery(this.inPKs(pks)))
        )
      : observeOn(this.getQuery())

    return lfIssueFix(changesOnQuery)
      .publishReplay(1)
      .refCount()
  }

  private set change$ (dist$: Observable<T[]>) {
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
      forEach(this.orderDescriptions, orderInfo =>
        rangeQuery.orderBy(orderInfo.column, orderInfo.orderBy!)
      )
    }

    rangeQuery.limit(this.limit!).skip(this.skip!)

    return rangeQuery
  }

  private get query(): lf.query.Select {
    const q = this.lselect.clone()

    if (this.orderDescriptions && this.orderDescriptions.length) {
      forEach(this.orderDescriptions, orderInfo =>
        q.orderBy(orderInfo.column, orderInfo.orderBy!)
      )
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
      warn(
        `Failed to build predicate, since ${err.message}` +
        `, on table: ${this.shape.mainTable.getName()}`
      )
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
    private orderDescriptions?: OrderInfo[]
  ) {
    this.predicateProvider = this.normPredicateProvider(predicateProvider)
    this.select = lselect.toSql()
  }

  toString(): string {
    return this.getQuery().toSql()
  }

  values(): Observable<T[]> | never {
    if (typeof this.limit !== 'undefined' || typeof this.skip !== 'undefined') {
      const p = this.rangeQuery.exec()
        .then(r => r.map(v => v[this.shape.pk.name]))
        .then(pks => this.getValue(this.getQuery(this.inPKs(pks))))
      return this.mapFn(Observable.fromPromise(p))
    } else {
      return this.mapFn(Observable.fromPromise(this.getValue(this.getQuery()) as Promise<T[]>))
    }
  }

  combine(... selectors: Selector<T>[]): Selector<T> {
    return Selector.combineFactory(this, ... selectors)
  }

  concat(... selectors: Selector<T>[]): Selector<T> {
    const orderStr = Selector.stringifyOrder(this.orderDescriptions!)
    const equal = selectors.every(m =>
      m.select === this.select &&
      Selector.stringifyOrder(m.orderDescriptions!) === orderStr &&
      m.mapFn.toString() === this.mapFn.toString() &&
      (
        (m.predicateProvider === this.predicateProvider) ||
        (
          !!(m.predicateProvider && this.predicateProvider) &&
          m.predicateProvider!.toString() === this.predicateProvider!.toString()
        )
      )
    )
    assert(equal, () => Exception.TokenConcatFailed())

    return Selector.concatFactory(this, ...selectors)
  }

  changes(): Observable<T[]> | never {
    return this.mapFn(this.change$)
  }

  map<K>(fn: (stream$: Observable<T[]>) => Observable<K[]>) {
    this.mapFn = fn
    return this as any as Selector<K>
  }

  private inPKs(pks: (string | number)[]): lf.Predicate {
    const { pk, mainTable } = this.shape
    return mainTable[pk.name].in(pks)
  }

  private getValue(query: lf.query.Select) {
    return query.exec()
      .then((rows: any[]) => {
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
    return Observable.create((observer: Observer<(string | number)[]>) => {
      const { rangeQuery } = this
      const listener = () => {
        return rangeQuery.exec()
          .then((r) => {
            observer.next(r.map(v => v[this.shape.pk.name]))
          })
          .catch(e => observer.error(e))
      }

      listener().then(() => {
        this.db.observe(rangeQuery, listener)
      })

      return () => this.db.unobserve(rangeQuery, listener)
    })
  }
}

/**
 * Lovefield observe 出来的推送，第一次和第二次在它们的值不为空
 * 的时候是重复的，这里做优化，省去重复；但不是简单的 skip(1)，因为
 * 那样会导致不能推出空结果集。详见：Lovefield issue#215
 */
const lfIssueFix = <T>(changes: Observable<T[]>) => {
  const doKeep = (prev: T[] | null, curr: T[] | null, idx: number) =>
    idx === 1 && prev && prev.length && curr && curr.length
      ? null
      : curr

  return (changes as any).scan(doKeep, null).filter(Boolean)
}
