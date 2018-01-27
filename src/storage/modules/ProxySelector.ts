import { Observable } from 'rxjs/Observable'
import { OperatorFunction } from 'rxjs/interfaces'
import { map } from 'rxjs/operators/map'
import { Query } from '../../interface'
import { mapFn } from './mapFn'

export class ProxySelector<T> {

  public request$: Observable<T[]>

  private mapFn: (stream$: Observable<T[]>) => Observable<any> = mapFn

  constructor (
    request$: Observable<T | T[]>,
    public query: Query<T>,
    public tableName: string
  ) {
    this.request$ = request$.pipe(
      map(r => Array.isArray(r) ? r : [ r ])
    )
  }

  values() {
    return this.mapFn(this.request$)
  }

  changes() {
    return this.mapFn(this.request$)
  }

  map<K>(fn: OperatorFunction<T[], K[]>) {
    this.mapFn = fn
    return this as any as ProxySelector<K>
  }
}
