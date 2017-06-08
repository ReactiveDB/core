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
  private static concatFactory<U>(... metaDatas: Selector<U>[]) {
    const [ meta ] = metaDatas
    const skipsAndLimits = metaDatas
      .map(m => ({ skip: m.skip, limit: m.limit }))
      .sort((x, y) => x.skip! - y.skip!)
    const { db, lselect, shape, predicateProvider } = meta
    const [ minSkip ] = skipsAndLimits
    const maxLimit = skipsAndLimits.reduce((acc, current) => {
      const nextSkip = acc.skip! + acc.limit!
      assert(current.skip === nextSkip, Exception.TokenConcatFailed(`
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
      .map(meta.mapFn)
  }

  private static combineFactory<U>(... metaDatas: Selector<U>[]) {
    const [ originalToken ] = metaDatas
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, { } as any)
    dist.change$ = Observable.from(metaDatas)
      .map(metas => metas.mapFn(metas.change$))
      .combineAll()
      .map((r: U[][]) => r.reduce((acc, val) => acc.concat(val)))
      .debounceTime(0, async)
      .publishReplay(1)
      .refCount()
    dist.values = () => {
      assert(!dist.consumed, Exception.TokenConsumed())
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

  private mapFn: <K>(stream$: Observable<T[]>) => Observable<K[]> = mapFn

  public select: string

  private change$: Observable<T[]>

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

  constructor(
    public db: lf.Database,
    private lselect: lf.query.Select,
    private shape: ShapeMatcher,
    public predicateProvider?: PredicateProvider<T> | null,
    private limit?: number,
    private skip?: number,
    private orderDescriptions?: OrderInfo[]
  ) {
    if (predicateProvider) {
      try {
        const predicate = predicateProvider.getPredicate()
        if (!predicate) {
          throw new TypeError()
        }
      } catch (err) {
        predicateProvider = null
        this.predicateProvider = null
        this.predicateBuildErr = true
        warn(
          `Failed to build predicate, since ${err.message}` +
          `, on table: ${shape.mainTable.getName()}`
        )
      }
    }
    skip = limit && !skip ? 0 : skip
    if (limit || skip) {
      this.change$ = this.buildPrefetchingObserve()
        .switchMap(pks => {
          return Observable.create((observer: Observer<T[]>) => {
            const query = this.getQuery(this.inPKs(pks))
            const listener = () => {
              this.getValue(query)
                .then(r => observer.next(r as T[]))
                .catch(e => observer.error(e))
            }
            listener()
            db.observe(query, listener)
            return () => this.db.unobserve(query, listener)
          })
        })
        .publishReplay(1)
        .refCount()
    } else {
      this.change$ = Observable.create((observer: Observer<T[]>) => {
        const query = this.getQuery()
        const listener = () => {
          this.getValue(query)
            .then(r => observer.next(r as T[]))
            .catch(e => observer.error(e))
        }
        db.observe(query, listener)
        listener() // 把 listener 放到 observe 后边执行，是 lovefield issue#209
                   //   https://github.com/google/lovefield/issues/209
                   // 的一个 workaround。issue 修复后，listener 也可以放在 observe
                   // 前面执行。
        return () => this.db.unobserve(query, listener)
      })
        .publishReplay(1)
        .refCount()
    }
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
      m.predicateProvider!.toString() === this.predicateProvider!.toString() &&
      Selector.stringifyOrder(m.orderDescriptions!) === orderStr &&
      m.mapFn.toString() === this.mapFn.toString()
    )
    assert(equal, Exception.TokenConcatFailed())

    return Selector.concatFactory(this, ... selectors)
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
    if (this.predicateBuildErr && !additional) {
      return this.query
    }
    // !this.predicateBuildErr || additional
    const preds: lf.Predicate[] = []
    if (this.predicateProvider && !this.predicateBuildErr) {
      preds.push(this.predicateProvider.getPredicate()!)
    }
    if (additional) {
      preds.push(additional)
    }
    const pred = lf.op.and(...preds)
    return this.query.where(pred)
  }

  private removeKey(data: any[], key: string) {
    data.forEach((entity) => delete entity[key])
    return data
  }

  private buildPrefetchingObserve(): Observable<(string | number)[]> {
    return Observable.create((observer: Observer<(string | number)[]>) => {
      const { rangeQuery } = this
      const listener = () => {
        rangeQuery.exec()
          .then((r) => {
            observer.next(r.map(v => v[this.shape.pk.name]))
          })
          .catch(e => observer.error(e))
      }
      listener()
      this.db.observe(rangeQuery, listener)
      return () => this.db.unobserve(rangeQuery, listener)
    })
    /**
     * TODO 这里返回的 observable 第一个值和第二个值在它们的值不为空
     * 的时候是重复的，也许有必要省去做优化；但不能简单 skip(1)，因为
     * 那样会导致不能推出空结果集。
     */
  }
}
