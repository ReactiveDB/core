import { Observable } from 'rxjs/Observable'
import { Selector } from './Selector'
import { ProxySelector } from './ProxySelector'
import { assert } from '../../utils/assert'
import { TokenConsumed } from '../../exception/token'

export type SelectorMeta<T> = Selector<T> | ProxySelector<T>

export class QueryToken<T> {
  selector$: Observable<SelectorMeta<T>>

  private consumed = false

  constructor(selector$: Observable<SelectorMeta<T>>) {
    this.selector$ = selector$.publishReplay(1)
      .refCount()
  }

  map<K>(fn: (stream$: Observable<T[]>) => Observable<K[]>) {
    this.selector$ = this.selector$
      .do(selector => (selector as any).map(fn) )
    return this as any as QueryToken<K>
  }

  values(): Observable<T[]> {
    assert(!this.consumed, TokenConsumed())

    this.consumed = true
    return (this.selector$ as Observable<Selector<T>>)
      .switchMap(s => s.values())
      .take(1)
  }

  changes(): Observable<T[]> {
    assert(!this.consumed, TokenConsumed())

    this.consumed = true
    return (this.selector$ as Observable<Selector<T>>)
      .switchMap(s => s.changes())
  }

  concat(...tokens: QueryToken<T>[]) {
    tokens.unshift(this)
    const newSelector$ = Observable.from(tokens)
      .map(token => token.selector$.skipWhile(v => v instanceof ProxySelector))
      .combineAll()
      .map((r: Selector<T>[]) => {
        const first = r.shift()
        return first!.concat(...r)
      })
    return new QueryToken<T>(newSelector$)
  }

  combine(...tokens: QueryToken<any>[]) {
    tokens.unshift(this)
    const newSelector$ = Observable.from(tokens)
      .map(token => token.selector$.skipWhile(v => v instanceof ProxySelector))
      .combineAll()
      .map((r: Selector<T>[]) => {
        const first = r.shift()
        return first!.combine(...r)
      })
    return new QueryToken<T>(newSelector$)
  }

  toString() {
    return this.selector$.map(r => r.toString())
  }
}
