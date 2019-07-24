import { Observable, OperatorFunction, from } from 'rxjs'
import { combineAll, filter, map, publishReplay, refCount, skipWhile, switchMap, take, tap } from 'rxjs/operators'
import { Selector } from './Selector'
import { ProxySelector } from './ProxySelector'
import { assert } from '../../utils/assert'
import { TokenConsumed } from '../../exception/token'
import { diff, Ops, OpsType, OpType } from '../../utils/diff'

export type TraceResult<T> = Ops & {
  result: ReadonlyArray<T>
}

function initialTraceResult<T>(list: ReadonlyArray<T>): TraceResult<T> {
  return {
    type: OpsType.Success,
    ops: list.map((_value, index) => ({ type: OpType.New, index })),
    result: list
  }
}

export type SelectorMeta<T> = Selector<T> | ProxySelector<T>

const skipWhileProxySelector = skipWhile((v) => v instanceof ProxySelector) as <T>(
  x: Observable<SelectorMeta<T>>,
) => Observable<Selector<T>>

export class QueryToken<T> {
  selector$: Observable<SelectorMeta<T>>

  private consumed = false

  constructor(
    selector$: Observable<SelectorMeta<T>>,
    private lastEmit?: ReadonlyArray<T>
  ) {
    this.selector$ = selector$.pipe(
      publishReplay(1),
      refCount(),
    )
    this.lastEmit = lastEmit
  }

  setLastEmit(data: T[]) {
    this.lastEmit = data
  }

  map<K>(fn: OperatorFunction<T[], K[]>) {
    this.selector$ = this.selector$.pipe(tap((selector) => (selector as any).map(fn)))
    return (this as any) as QueryToken<K>
  }

  values(): Observable<T[]> {
    assert(!this.consumed, TokenConsumed)

    this.consumed = true
    return this.selector$.pipe(
      switchMap((s) => s.values()),
      take(1),
    )
  }

  changes(): Observable<T[]> {
    assert(!this.consumed, TokenConsumed)

    this.consumed = true
    return this.selector$.pipe(switchMap((s) => s.changes()))
  }

  traces(pk?: string): Observable<TraceResult<T>> {
    return this.changes().pipe(
      map((result: T[]) => {
        if (!this.lastEmit) {
          return initialTraceResult(result)
        }
        const ops = diff(this.lastEmit, result, pk)
        return { result, ...ops }
      }),
      filter(({ type }) => type !== OpsType.ShouldSkip),
      tap(({ result }) => (this.lastEmit = result)),
    )
  }

  concat(...tokens: QueryToken<T>[]) {
    tokens.unshift(this)
    const newSelector$ = from(tokens).pipe(
      map((token) => token.selector$.pipe(skipWhileProxySelector)),
      combineAll<Selector<T>>(),
      map((r) => {
        const first = r.shift()
        return first!.concat(...r)
      }),
    )
    return new QueryToken<T>(newSelector$, this.lastEmit)
  }

  combine(...tokens: QueryToken<any>[]) {
    tokens.unshift(this)
    const newSelector$ = from(tokens).pipe(
      map((token) => token.selector$.pipe(skipWhileProxySelector)),
      combineAll<Selector<T>>(),
      map((r) => {
        const first = r.shift()
        return first!.combine(...r)
      }),
    )
    return new QueryToken<T>(newSelector$, this.lastEmit)
  }

  toString() {
    return this.selector$.pipe(map((r) => r.toString()))
  }
}
