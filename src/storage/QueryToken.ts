'use strict'
import { Observable } from 'rxjs/Observable'
import { SelectMeta } from './SelectMeta'

export class QueryToken <T> {
  private selectMeta$: Observable<SelectMeta<T>>

  constructor(meta$: Observable<SelectMeta<T>>) {
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
      .map((r: SelectMeta<T>[]) => {
        const first = r.shift()
        return first.combine(... r)
      })
    return new QueryToken(newMeta$)
  }
}
