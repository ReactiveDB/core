import './RxOperator'
import { Observer } from 'rxjs/Observer'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { PredicateProvider } from './PredicateProvider'
import {
  TOKEN_CONCAT_ERR,
  TOKEN_CONSUMED_ERR,
  BUILD_PREDICATE_FAILED_WARN
} from './RuntimeError'
import { identity, forEach } from '../utils'
import graphify from './Graphify'

export interface TableShape {
  mainTable: lf.schema.Table
  pk: {
    name: string,
    queried: boolean
  }
  definition: Object
}

export interface OrderInfo {
  column: lf.schema.Column
  orderBy: lf.Order
}

export class Selector <T> {
  static concatFactory<U>(... metaDatas: Selector<U>[]) {
    const [ meta ] = metaDatas
    const skipsAndLimits = metaDatas
      .map(m => ({ skip: m.skip, limit: m.limit }))
      .sort((x, y) => x.skip - y.skip)
    const { db, lselect, shape, predicateProvider } = meta
    const [ minSkip ] = skipsAndLimits
    const maxLimit = skipsAndLimits.reduce((acc, current) => {
      const nextSkip = acc.skip + acc.limit
      if (current.skip !== nextSkip) {
        throw TOKEN_CONCAT_ERR(`
          skip should be serial,
          expect: ${JSON.stringify(acc, null, 2)}
          actual: ${nextSkip}
        `)
      }
      return current
    })
    return new Selector(db, lselect, shape, predicateProvider, maxLimit.limit + maxLimit.skip, minSkip.skip)
  }

  static combineFactory<U>(... metaDatas: Selector<U>[]) {
    const [ originalToken ] = metaDatas
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, { } as any)
    dist.change$ = Observable.from(metaDatas)
      .map(metas => metas.change$)
      .combineAll()
      .map((r: U[][]) => r.reduce((acc, val) => acc.concat(val)))
      .publishReplay(1)
      .refCount()
    dist.values = () => {
      if (dist.consumed) {
        throw TOKEN_CONSUMED_ERR()
      }
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

  public select: string

  public change$: Observable<T[]>
  private consumed = false
  private predicateBuildErr = false

  private get rangeQuery(): lf.query.Select {
    let predicate: lf.Predicate
    const { predicateProvider } = this
    if (predicateProvider && !this.predicateBuildErr) {
      predicate = predicateProvider.getPredicate()
    }
    const { pk, mainTable } = this.shape
    const rangeQuery = this.db.select(mainTable[pk.name])
        .from(mainTable)

    if (this.orderDescriptions && this.orderDescriptions.length) {
      forEach(this.orderDescriptions, orderInfo =>
        rangeQuery.orderBy(orderInfo.column, orderInfo.orderBy)
      )
    }

    rangeQuery
      .limit(this.limit)
      .skip(this.skip)

    return predicate ? rangeQuery.where(predicate) : rangeQuery
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
    private shape: TableShape,
    public predicateProvider?: PredicateProvider<T>,
    private limit?: number,
    private skip?: number,
    private orderDescriptions?: OrderInfo[]
  ) {
    let predicate: lf.Predicate
    if (predicateProvider) {
      try {
        predicate = predicateProvider.getPredicate()
        if (!predicate) {
          this.predicateProvider = null
          this.predicateBuildErr = true
        }
      } catch (e) {
        this.predicateProvider = null
        this.predicateBuildErr = true
        BUILD_PREDICATE_FAILED_WARN(e, shape.mainTable.getName())
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
            predicate = predicate ? lf.op.and($in, predicate) : $in
            const query = this.query
              .where(predicate)
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
        const query = predicate ? this.query
          .where(predicate) : this.query
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
    if (this.consumed) {
      throw TOKEN_CONSUMED_ERR()
    }

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
    const equal = selectMetas.every(m =>
      m.select === this.select &&
      m.predicateProvider.toString() === this.predicateProvider.toString()
    )
    if (!equal) {
      throw TOKEN_CONCAT_ERR()
    }
    return Selector.concatFactory(this, ... selectMetas)
  }

  changes(): Observable<T[]> | never {
    if (this.consumed) {
      throw TOKEN_CONSUMED_ERR()
    }
    this.consumed = true
    return this.change$
  }

  private getValue(pks?: (string | number)[]) {
    let q: lf.query.Select
    if (pks) {
      const predIn = this.shape.mainTable[this.shape.pk.name].in(pks)
      const predicate = !this.predicateProvider || this.predicateBuildErr ? predIn : lf.op.and(
        predIn, this.predicateProvider.getPredicate()
      )
      q = this.query
        .where(predicate)
    } else {
      q = this.query
      if (!this.predicateBuildErr) {
        q = q.where(this.predicateProvider.getPredicate())
      }
    }
    return q.exec()
      .then((rows: any[]) => {
        const result = graphify<T>(rows, this.shape.definition)
        const col = this.shape.pk.name
        return !this.shape.pk.queried ? this.removeKey(result, col) : result
      })
  }

  private removeKey(data: any[], key: string) {
    data.forEach((entity) => {
      delete entity[key]
    })

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
      // 多 emit 了一个值？？？
      .skip(1)
  }
}
