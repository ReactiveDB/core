import { Observable } from 'rxjs/Observable'
import { Selector } from './Selector'

export type Mapper = <K, V>(v: K) => V

export class QueryToken<T> {
  selectMeta$: Observable<Selector<T>>

  constructor(meta$: Observable<Selector<T>>) {
    this.selectMeta$ = meta$.publishReplay(1)
      .refCount()
  }

  map(fn: Mapper) {
    return new QueryToken(this.selectMeta$.do(selector => {
      const previousValues = selector.values
      const previousChange$ = selector.change$

      selector.change$ = previousChange$
        .map((val: any[]) => val.map(fn))
      selector.values = () => previousValues.call(selector)
        .map((val: any[]) => val.map(fn))
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
