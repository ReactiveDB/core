import { Observable } from 'rxjs/Observable'
import { Selector } from './Selector'

export class QueryToken<T> {
  selectMeta$: Observable<Selector<T>>

  constructor(meta$: Observable<Selector<T>>) {
    this.selectMeta$ = meta$.publishReplay(1)
      .refCount()
  }

  map<K>(fn: (val: T, index?: number) => K) {
    return new QueryToken<K>((this.selectMeta$ as Observable<Selector<any>>).do((selector) => {
      const previousValues = selector.values
      const previousChange$ = selector.change$

      selector.change$ = previousChange$
        .map((val: T[]) => val.map(fn))
      selector.values = () => previousValues.call(selector)
        .map((val: T[]) => val.map(fn))
    }))
  }

  values() {
    return this.selectMeta$
      .flatMap(meta => meta.values())
  }

  changes() {
    return this.selectMeta$
      .flatMap(meta => meta.changes())
  }

  concat(...tokens: QueryToken<T>[]) {
    tokens.unshift(this)
    const newMeta$ = Observable.from(tokens)
      .map(token => token.selectMeta$)
      .combineAll()
      .map((r: Selector<T>[]) => {
        const first = r.shift()
        return first.concat(...r)
      })
    return new QueryToken(newMeta$)
  }

  combine(...tokens: QueryToken<T>[]) {
    tokens.unshift(this)
    const newMeta$ = Observable.from(tokens)
      .map(token => token.selectMeta$)
      .combineAll()
      .map((r: Selector<T>[]) => {
        const first = r.shift()
        return first.combine(...r)
      })
    return new QueryToken(newMeta$)
  }

  toString() {
    return this.selectMeta$
      .map(r => r.toString())
  }
}
