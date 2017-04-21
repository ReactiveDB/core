import { Observable } from 'rxjs/Observable'
import { Query } from '../../interface'

export class ProxySelector<T> {

  private mapFn: <U, K>(v: U, index?: number, array?: U[]) => K = (v: T) => v

  constructor (
    public request$: Observable<T> | Observable<T[]>,
    public query: Query<T>,
    public tableName: string
  ) {
    this.request$ = this.request$.map((v: T| T[]) => {
      if (typeof this.mapFn === 'function') {
        if (Array.isArray(v)) {
          return v.map(this.mapFn)
        } else {
          return [this.mapFn(v)]
        }
      }
      return v
    })
  }

  setMapFn(fn: <K>(v: T, index?: number, array?: T[]) => K) {
    this.mapFn = fn
  }

  values() {
    return this.request$
  }

  changes() {
    return this.request$
  }
}
