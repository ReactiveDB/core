import { Observable } from 'rxjs/Observable'
import { Selector } from './Selector'
import { ProxySelector } from './ProxySelector'

export type SelectorMeta<T> = Selector<T> | ProxySelector<T>

export class QueryToken<T> {

  constructor(public selector$: Observable<SelectorMeta<T>>) { }

  map<K>(fn: (stream$: Observable<T[]>) => Observable<K[]>) {
    this.selector$ = this.selector$
      .do(s => this.decoratorSelector(s, fn))
    return this as any as QueryToken<K>
  }

  values(): Observable<T[]> {
    return (this.selector$ as Observable<Selector<T>>)
      .switchMap(s => s.values())
      .take(1)
  }

  changes(): Observable<T[]> {
    return (this.selector$ as Observable<Selector<T>>)
      .switchMap(s => s.changes())
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
        return first![method](...r)
      })
    return new QueryToken<T>(newSelector$)
  }

  private decoratorSelector(selector: SelectorMeta<T>, fn: <K>(stream$: Observable<T[]>) => Observable<K[]>) {
    const methods = ['changes', 'values']
    methods.forEach(method => {
      const originFn = selector[method]
      selector[method] = () => {
        const dist$ = originFn.call(selector)
        if (typeof fn === 'function') {
          return fn(dist$)
        }
        return dist$
      }
    })
  }
}
