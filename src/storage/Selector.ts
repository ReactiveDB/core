import './RxOperator'
import { Observer } from 'rxjs/Observer'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import {
  TOKEN_INVALID_ERR,
  TOKEN_CONSUMED_ERR
} from './RuntimeError'
import { identity } from '../utils'
import graphify from './Graphify'

export type GraphMapper = (data: any) => any

export interface TableShape {
  pk: {
    name: string,
    queried: boolean
  }
  definition: Object
}

export class Selector <T> {
  static factory<U>(... metaDatas: Selector<U>[]) {
    const originalToken = metaDatas[0]
    const fakeQuery = { toSql: identity }
    // 初始化一个空的 QuerySelector，然后在初始化以后替换它上面的属性和方法
    const dist = new Selector<U>(originalToken.db, fakeQuery as any, identity)
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
  private query: lf.query.Select

  constructor(
    public db: lf.Database,
    select: lf.query.Select,
    private shape: TableShape | GraphMapper,
    public predicate?: lf.Predicate
  ) {
    this.select = select.toSql()
    this.query = predicate ? select.where(predicate) : select

    this.change$ = Observable.create((observer: Observer<T[]>) => {
      const listener = () => {
        this.getValue()
          .then(r => observer.next(r as T[]))
          .catch(e => observer.error(e))
      }
      listener()
      db.observe(this.query, listener)

      return () => this.db.unobserve(this.query, listener)
    })
  }

  toString(): string {
    return this.query.toSql()
  }

  values(): Observable<T[]> | never {
    if (this.consumed) {
      throw TOKEN_CONSUMED_ERR()
    }

    this.consumed = true
    return Observable.fromPromise(this.getValue() as Promise<T[]>)
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

  private getValue() {
    return this.query
      .exec()
      .then((rows: any[]) => {
        // manually provided mapper function
        if (typeof this.shape === 'function') {
          return this.shape(rows)
        }

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
}
