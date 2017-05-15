import { Observable } from 'rxjs/Observable'
import { Query } from '../../interface'
import { mapFn } from './mapFn'

export class ProxySelector<T> {

  public request$: Observable<T[]>

  private mapFn = mapFn

  constructor (
    request$: Observable<T> | Observable<T[]>,
    public query: Query<T>,
    public tableName: string
  ) {
    this.request$ = request$.map((r: T | T[]) => {
      if (Array.isArray(r)) {
        return r
      } else {
        return [ r ]
      }
    })
  }

  values() {
    return this.mapFn(this.request$)
  }

  changes() {
    return this.mapFn(this.request$)
  }

  map<K>(fn: (stream$: Observable<T[]>) => Observable<K[]>) {
    this.mapFn = fn
    return this as any as ProxySelector<K>
  }
}
