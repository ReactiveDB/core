import './RxOperator'
import { Observer } from 'rxjs/Observer'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import { PredicateProvider } from './PredicateProvider'
import {
  TOKEN_INVALID_ERR,
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
  static factory<U>(... metaDatas: Selector<U>[]) {
    const originalToken = metaDatas[0]
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, { } as any)
    dist.change$ = Observable.from(metaDatas)
      .map(metas => metas.change$)
      .combineAll()
      .map((r: U[][]) => r.reduce((acc, val) => acc.concat(val)))
    dist.values = () => {
      return Observable.from(metaDatas)
        .map(metaData => metaData.values())
        .flatMap(identity)
        .reduce((acc: U[], val: U[]) => acc.concat(val))
    }
    dist.select = originalToken.select
    return dist
  }

  public select: string

  private change$: Observable<T[]>
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
    public predicateProvider?: PredicateProvider,
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
    }
    this.select = lselect.toSql()
  }

  toString(): string {
    return this.query.toSql()
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
    const isEqual = selectMetas.every(meta => meta.select === this.select)
    if (!isEqual) {
      throw TOKEN_INVALID_ERR()
    }
    return Selector.factory(this, ... selectMetas)
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
          .then((r) => observer.next(r.map(v => v[this.shape.pk.name])))
          .catch(e => observer.error(e))
      }
      listener()
      this.db.observe(rangeQuery, listener)
      return () => this.db.unobserve(rangeQuery, listener)
    })
  }
}
