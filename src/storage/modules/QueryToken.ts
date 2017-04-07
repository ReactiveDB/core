import { Observable } from 'rxjs/Observable'
import { Selector } from './Selector'
import { ProxySelector } from './ProxySelector'

export type SelectorMeta<T> = Selector<T> | ProxySelector<T>

export class QueryToken<T> {

  mapFn: <J, K>(v: J, index?: number, array?: J[]) => K
  selector$: Observable<SelectorMeta<T>>

  constructor(meta$: Observable<SelectorMeta<T>>) {
    this.selector$ = meta$
      .do((selector: SelectorMeta<T>) => {
        if (!(selector instanceof ProxySelector)) {
          (selector as Selector<T>).setMapFn(this.mapFn)
        }
      })
      .publishReplay(1)
      .refCount()
  }

  map<K>(fn: (v: T, index?: number, array?: T[]) => K) {
    this.mapFn = fn
    return this
  }

  values() {
    return (this.selector$ as Observable<Selector<T>>)
      .switchMap(selector => selector.values())
  }

  changes() {
    return (this.selector$ as Observable<Selector<T>>)
      .switchMap(selector => selector.changes())
  }

  concat(...tokens: QueryToken<T>[]) {
    return this.composeFactory(tokens, 'combine')
  }

  combine(...tokens: QueryToken<T>[]) {
    return this.composeFactory(tokens, 'combine')
  }

  toString() {
    return this.selector$.map(r => r.toString())
  }

  private composeFactory(tokens: QueryToken<T>[], method: string) {
    tokens.unshift(this)
    const newSelector$ = Observable.from(tokens)
      .map(token => token.selector$.skipWhile(v => v instanceof ProxySelector))
      .combineAll()
      .map((r: Selector<T>[]) => {
        const first = r.shift()
        return first[method](...r)
      })
    return new QueryToken(newSelector$)
  }
}
