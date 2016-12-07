'use strict'
import 'rxjs/add/operator/combineLatest'
import 'rxjs/add/operator/switchMap'
import 'rxjs/add/operator/concatMapTo'
import { Observable } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'
import * as lf from 'lovefield'
import { SelectMeta } from './SelectMeta'

export class QueryToken<T> {
  cousumed = false

  private selectMeta$ = this._selectMeta$
    .publishReplay(1)
    .refCount()

  private db$ = this.selectMeta$
    .map(meta => meta.db)

  private select$ = this.selectMeta$
    .map(meta => meta.select.clone())

  private predicate$ = this.selectMeta$
    .map(meta => meta.predicate.copy())

  private dbObserve: () => Promise<void> | null
  private query: lf.query.Select

  constructor(
    private _selectMeta$: Observable<SelectMeta<T>>
  ) { }

  value(): Observable<T[]> {
    if (this.cousumed) {
      return Observable.throw(new TypeError(`QueryToken consumed`))
    }
    this.cousumed = true
    return this.selectMeta$
      .concatMap(meta => meta.getValue())
  }

  combine(otherResult: QueryToken<T>) {
    if (this.cousumed) {
      throw new TypeError(`QueryToken consumed`)
    }
    this.cousumed = true
    const selectMeta$ = this.select$.combineLatest(otherResult.select$)
      .map(([select1, select2]) => {
        return select1.toSql() === select2.toSql()
      })
      .concatMap(isEqual => {
        if (!isEqual) {
          return Observable.throw(new TypeError(`Could not combine`))
        } else {
          const dispose$ = this.dispose()
          const meta$ = this.selectMeta$.combineLatest(this.predicate$, otherResult.predicate$)
            .map(([meta, pred1, pred2]) => SelectMeta.replacePredicate(meta, lf.op.or(pred1, pred2)))
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
    if (this.cousumed) {
      return Observable.throw(`QueryToken consumed`)
    }
    this.cousumed = true
    return this.db$.combineLatest(this.select$, this.predicate$, this.selectMeta$)
      .concatMap(([db, select, predicate, selectMeta]) => {
        return Observable.create((observer: Observer<T[]>) => {
          const query = predicate ? select.where(predicate) : select
          selectMeta.getValue()
            .then(first => observer.next(first as T[]))
          db.observe(query, this.observe(query, observer, selectMeta))
        })
      })
  }

  dispose(): Observable<any> | void {
    if (this.query) {
      return this.db$
        .do(db => db.unobserve(this.query, this.dbObserve))
    }
  }

  private observe(query: lf.query.Select, observer: Observer<T[]>, selectMeta: SelectMeta<T>) {
    this.dbObserve = () => {
      return selectMeta.getValue()
        .then(r => observer.next(r as T[]))
        .catch(e => observer.error(e))
    }
    this.query = query
    return this.dbObserve
  }
}
