'use strict'
import 'rxjs/add/operator/scan'
import 'rxjs/add/operator/reduce'
import 'rxjs/add/operator/startWith'
import { Observer } from 'rxjs/Observer'
import { Observable } from 'rxjs/Observable'
import * as lf from 'lovefield'
import {
  TOKEN_INVALID_ERR,
  TOKEN_CONSUMED_ERR
} from './RuntimeError'
import { flat } from '../utils'

export class SelectMeta <T> {
  static factory<U>(... metaDatas: SelectMeta<U>[]) {
    const originalToken = metaDatas[0]
    const fakeQuery = { toSql: flat }
    // 初始化一个空的 SelectMeta，然后在初始化以后替换它上面的属性和方法
    const dist = new SelectMeta<U>(originalToken.db, fakeQuery as any, flat)
    dist.change$ = Observable.from(metaDatas)
      .map(metas => metas.change$)
      .combineAll()
      .map((r: U[][]) => r.reduce((acc, val) => acc.concat(val)))
    dist.values = () => {
      return Observable.from(metaDatas)
        .map(metaData => metaData.values())
        .flatMap(flat)
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
    private fold: (values: T[]) => T[],
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

  values(): Observable<T[]> | never {
    if (this.consumed) {
      throw TOKEN_CONSUMED_ERR()
    }
    this.consumed = true
    return Observable.fromPromise(this.getValue())
  }

  combine(... selectMetas: SelectMeta<T>[]): SelectMeta<T> {
    const isEqual = selectMetas.every(meta => meta.select === this.select)
    if (!isEqual) {
      throw TOKEN_INVALID_ERR()
    }
    return SelectMeta.factory(this, ... selectMetas)
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
      .then(this.fold)
  }
}
