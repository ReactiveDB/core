'use strict'
import { Observable } from 'rxjs/Observable'
import { Selector } from './Selector'

export class QueryToken <T> {
  private selectMeta$: Observable<Selector<T>>

  constructor(meta$: Observable<Selector<T>>) {
    this.selectMeta$ = meta$.publishReplay(1)
      .refCount()
  }

  values() {
    return this.selectMeta$
      .flatMap(meta => meta.values())
  }

  changes() {
    return this.selectMeta$
      .flatMap(meta => meta.changes())
  }

  combine(... tokens: QueryToken<T>[]) {
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
}
