'use strict'
import { Observable } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'
import * as lf from 'lovefield'
import { SelectMeta } from './SelectMeta'
import {
  TOKEN_INVALID_ERR,
  TOKEN_CONSUMED_ERR
} from './RuntimeError'
export class QueryToken<T> {
  consumed = false

  private selectMeta$ = this._selectMeta$
    .publishReplay(1)
    .refCount()

  private db$ = this.selectMeta$
    .map(meta => meta.db)

  private select$ = this.selectMeta$
    .map(meta => meta.select.clone())

  private predicate$ = this.selectMeta$
    .map(meta => {
      return meta.predicate ? meta.predicate.copy() : null
    })

  private dbObserve: () => Promise<void> | null
  private query: lf.query.Select

  constructor(
    private _selectMeta$: Observable<SelectMeta<T>>
  ) { }

  value(): Observable<T[]> {
    if (this.consumed) {
      return Observable.throw(TOKEN_CONSUMED_ERR())
    }
    this.consumed = true
    return this.selectMeta$
      .concatMap(meta => meta.getValue())
  }

  combine(...tokens: QueryToken<T>[]) {
    if (this.consumed) {
      throw TOKEN_CONSUMED_ERR()
    }
    this.consumed = true
    const selectMeta$ =
      this.select$
      .combineLatest(tokens.map((item) => item.select$))
      .map((selectQuery) => {
        return selectQuery.every((query: any) => query.toSql() === selectQuery[0].toSql())
      })
      .concatMap(isEqual => {
        if (!isEqual) {
          return Observable.throw(TOKEN_INVALID_ERR())
        } else {
          const dispose$ = this.dispose()
          const meta$ = this.selectMeta$
            .combineLatest([this.predicate$]
              .concat(tokens.map((query) => query.predicate$)))
            .map(([meta, ...preds]) =>
              SelectMeta.replacePredicate(meta, lf.op.or.apply(lf.op, preds)))
          if (dispose$) {
            return dispose$.concatMapTo(meta$)
          } else {
            return meta$
          }
        }
      })
    return new QueryToken<T>(selectMeta$)
  }

  changes(): Observable<T[]> {
    if (this.consumed) {
      return Observable.throw(TOKEN_CONSUMED_ERR())
    }
    this.consumed = true
    return this.db$.combineLatest(this.select$, this.predicate$, this.selectMeta$)
      .concatMap(([db, select, predicate, selectMeta]) => {
        return Observable.create((observer: Observer<T[]>) => {
          const query = predicate ? select.where(predicate) : select
          selectMeta.getValue()
            .then(first => observer.next(first as T[]))
          db.observe(query, this.observe(query, observer, selectMeta))

          return () => this.dispose()
        })
      })
  }

  private dispose(): Observable<any> | void {
    if (this.query) {
      return this.db$
        .do(db => db.unobserve(this.query, this.dbObserve))
    }
  }

  private observe(query: lf.query.Select, observer: Observer<T[]>, selectMeta: SelectMeta<T>) {
    this.dbObserve = () => {
      return selectMeta.getValue()
        .then(ret => observer.next(ret as T[]))
        .catch(err => observer.error(err))
    }
    this.query = query
    return this.dbObserve
  }
}
