import { Observable } from 'rxjs/Observable'
import { OperatorFunction } from 'rxjs/interfaces'
import { combineAll } from 'rxjs/operators/combineAll'
import { filter } from 'rxjs/operators/filter'
import { map } from 'rxjs/operators/map'
import { publishReplay } from 'rxjs/operators/publishReplay'
import { refCount } from 'rxjs/operators/refCount'
import { skipWhile } from 'rxjs/operators/skipWhile'
import { switchMap } from 'rxjs/operators/switchMap'
import { take } from 'rxjs/operators/take'
import { tap } from 'rxjs/operators/tap'
import { Selector } from './Selector'
import { ProxySelector } from './ProxySelector'
import { assert } from '../../utils/assert'
import { TokenConsumed } from '../../exception/token'
import { diff, Ops, OpsType } from '../../utils/diff'

export type TraceResult<T> = Ops & {
  result: T[]
}

export type SelectorMeta<T> = Selector<T> | ProxySelector<T>

const skipWhileProxySelector =
  skipWhile(v => v instanceof ProxySelector) as <T>(x: Observable<SelectorMeta<T>>) => Observable<Selector<T>>

export class QueryToken<T> {
  selector$: Observable<SelectorMeta<T>>

  private consumed = false
  private lastEmit: T[] = []

  constructor(selector$: Observable<SelectorMeta<T>>, lastEmit?: T[]) {
    this.selector$ = selector$.pipe(
      publishReplay(1),
      refCount()
    )
    this.lastEmit = lastEmit || []
  }

  setLastEmit(data: T[]) {
    this.lastEmit = data
  }

  map<K>(fn: OperatorFunction<T[], K[]>) {
    this.selector$ = this.selector$.pipe(
      tap(selector => (selector as any).map(fn))
    )
    return this as any as QueryToken<K>
  }

  values(): Observable<T[]> {
    assert(!this.consumed, TokenConsumed())

    this.consumed = true
    return this.selector$.pipe(
      switchMap(s => s.values()),
      take(1)
    )
  }

  changes(): Observable<T[]> {
    assert(!this.consumed, TokenConsumed())

    this.consumed = true
    return this.selector$.pipe(
      switchMap(s => s.changes())
    )
  }

  traces(pk?: string): Observable<TraceResult<T>> {
    return this.changes().pipe(
      map((result: T[]) => {
        const ops = diff(this.lastEmit, result, pk)
        return { result, ...ops }
      }),
      filter((xs) => xs.type !== OpsType.ShouldSkip),
      tap(({ result }) => (this.lastEmit = result)),
    )
  }

  concat(...tokens: QueryToken<T>[]) {
    tokens.unshift(this)
    const newSelector$ = Observable.from(tokens).pipe(
      map(token => token.selector$.pipe(skipWhileProxySelector)),
      combineAll<Observable<Selector<T>>, Selector<T>[]>(),
      map((r) => {
        const first = r.shift()
        return first!.concat(...r)
      })
    )
    return new QueryToken<T>(newSelector$, this.lastEmit)
  }

  combine(...tokens: QueryToken<any>[]) {
    tokens.unshift(this)
    const newSelector$ = Observable.from(tokens).pipe(
      map(token => token.selector$.pipe(skipWhileProxySelector)),
      combineAll<Observable<Selector<T>>, Selector<T>[]>(),
      map((r) => {
        const first = r.shift()
        return first!.combine(...r)
      })
    )
    return new QueryToken<T>(newSelector$, this.lastEmit)
  }

  toString() {
    return this.selector$.pipe(map(r => r.toString()))
  }
}
