import { Observable } from 'rxjs/Observable'
import { Query } from '../../interface'

export class ProxySelector<T> {

  constructor (
    public request$: Observable<T> | Observable<T[]>,
    public query: Query<T>,
    public tableName: string
  ) { }

  values() {
    return this.request$
  }

  changes() {
    return this.request$
  }
}
