import { Observer } from 'rxjs/Observer'
import { Observable } from 'rxjs/Observable'
import { async } from 'rxjs/scheduler/async'
import * as lf from 'lovefield'
import * as Exception from '../../exception'
import { predicatableQuery, graph } from '../helper'
import { identity, forEach, assert, warn } from '../../utils'
import { PredicateProvider } from './PredicateProvider'
import { ShapeMatcher, OrderInfo, StatementType } from '../../interface'

export class Selector <T> {
  private static concatFactory<U>(... metaDatas: Selector<U>[]) {
    const [ meta ] = metaDatas
    const skipsAndLimits = metaDatas
      .map(m => ({ skip: m.skip, limit: m.limit }))
      .sort((x, y) => x.skip - y.skip)
    const { db, lselect, shape, predicateProvider } = meta
    const [ minSkip ] = skipsAndLimits
    const maxLimit = skipsAndLimits.reduce((acc, current) => {
      const nextSkip = acc.skip + acc.limit
      assert(current.skip === nextSkip, Exception.TokenConcatFailed(`
        skip should be serial,
        expect: ${JSON.stringify(acc, null, 2)}
        actual: ${nextSkip}
      `))
      return current
    })
    return new Selector(
      db, lselect, shape, predicateProvider,
      maxLimit.limit + maxLimit.skip, minSkip.skip, meta.orderDescriptions
    )
  }

  private static combineFactory<U>(... metaDatas: Selector<U>[]) {
    const [ originalToken ] = metaDatas
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, { } as any)
    dist.change$ = Observable.from(metaDatas)
      .map(metas => metas.change$)
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

  public select: string

  public change$: Observable<T[]>

  private mapFn: <J, K>(v: J, index?: number, array?: J[]) => K = (v: T) => v

  private consumed = false
  private predicateBuildErr = false

  private get rangeQuery(): lf.query.Select {
    let predicate: lf.Predicate = null
    const { predicateProvider } = this
    if (predicateProvider && !this.predicateBuildErr) {
      predicate = predicateProvider.getPredicate()
    }
    const { pk, mainTable } = this.shape

    const column = mainTable[pk.name]
    const rangeQuery = predicatableQuery(this.db, mainTable, predicate, StatementType.Select, column)

    if (this.orderDescriptions && this.orderDescriptions.length) {
      forEach(this.orderDescriptions, orderInfo =>
        rangeQuery.orderBy(orderInfo.column, orderInfo.orderBy)
      )
    }

    rangeQuery.limit(this.limit).skip(this.skip)

    return rangeQuery
  }

  private get query(): lf.query.Select {
    const q = this.lselect.clone()

    if (this.orderDescriptions && this.orderDescriptions.length) {
      forEach(this.orderDescriptions, orderInfo =>
        q.orderBy(orderInfo.column, orderInfo.orderBy)
      )
    }

    return q
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
    if (predicateProvider) {
      try {
        const predicate = predicateProvider.getPredicate()
        if (!predicate) {
          predicateProvider = null
          this.predicateProvider = null
          this.predicateBuildErr = true
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
      const { pk, mainTable } = this.shape
      this.change$ = this.buildPrefetchingObserve()
        .switchMap(pks => {
          return Observable.create((observer: Observer<T[]>) => {
            const listener = () => {
              this.getValue(pks)
                .then(r => observer.next(r as T[]))
                .catch(e => observer.error(e))
            }
            listener()
            const $in = mainTable[pk.name].in(pks)
            const $predicate = predicateProvider
              ? lf.op.and($in, predicateProvider.getPredicate())
              : $in
            const query = this.query
              .where($predicate)
            db.observe(query, listener)
            return () => this.db.unobserve(query, listener)
          })
        })
        .publishReplay(1)
        .refCount()
    } else {
      this.change$ = Observable.create((observer: Observer<T[]>) => {
        const listener = () => {
          this.getValue()
            .then(r => observer.next(r as T[]))
            .catch(e => observer.error(e))
        }
        const query = predicateProvider ? this.query
          .where(predicateProvider.getPredicate()) : this.query
        listener()
        db.observe(query, listener)

        return () => this.db.unobserve(query, listener)
      })
        .publishReplay(1)
        .refCount()
    }
    this.select = lselect.toSql()
  }

  toString(): string {
    let predicate: lf.Predicate
    const { predicateProvider } = this
    if (predicateProvider && !this.predicateBuildErr) {
      predicate = predicateProvider.getPredicate()
    }
    return predicate ? this.query.where(predicate).toSql() : this.query.toSql()
  }

  values(): Observable<T[]> | never {
    assert(!this.consumed, Exception.TokenConsumed())

    this.consumed = true
    if (this.limit || this.skip) {
      const p = this.rangeQuery.exec()
        .then(r => r.map(v => v[this.shape.pk.name]))
        .then(pks => this.getValue(pks))
      return Observable.fromPromise(p)
    } else {
      return Observable.fromPromise(this.getValue() as Promise<T[]>)
    }
  }

  combine(... selectMetas: Selector<T>[]): Selector<T> {
    return Selector.combineFactory(this, ... selectMetas)
  }

  concat(... selectMetas: Selector<T>[]): Selector<T> {
    const orderStr = Selector.stringifyOrder(this.orderDescriptions)
    const equal = selectMetas.every(m =>
      m.select === this.select &&
      m.predicateProvider.toString() === this.predicateProvider.toString() &&
      Selector.stringifyOrder(m.orderDescriptions) === orderStr
    )
    assert(equal, Exception.TokenConcatFailed())

    return Selector.concatFactory(this, ... selectMetas)
  }

  changes(): Observable<T[]> | never {
    assert(!this.consumed, Exception.TokenConsumed())
    this.consumed = true
    return this.change$
  }

  setMapFn<J, K>(fn: (v: J, index?: number, array?: J[]) => K) {
    this.mapFn = fn
  }

  private getValue(pks?: (string | number)[]) {
    let q: lf.query.Select
    if (pks) {
      const predIn = this.shape.mainTable[this.shape.pk.name].in(pks)
      const predicate = (!this.predicateProvider || this.predicateBuildErr)
        ? predIn
        : lf.op.and(predIn, this.predicateProvider.getPredicate())

      q = this.query.where(predicate)
    } else {
      q = this.query
      if (!this.predicateBuildErr) {
        q = q.where(this.predicateProvider.getPredicate())
      }
    }
    return q.exec()
      .then((rows: any[]) => {
        const result = graph<T>(rows, this.shape.definition)
        const col = this.shape.pk.name
        return !this.shape.pk.queried ? this.removeKey(result, col) : result
      })
      .then(v => {
        if (typeof this.mapFn === 'function') {
          v = v.map(this.mapFn)
        }
        return v
      })
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
