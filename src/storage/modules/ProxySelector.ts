import { Observable } from 'rxjs/Observable'
import { Query } from '../../interface'

export class ProxySelector<T> {

  public request$: Observable<T[]>

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
    return this.request$
  }

  changes() {
    return this.request$
  }
}
