import { Observable } from 'rxjs/Observable'
import { OperatorFunction } from 'rxjs/interfaces'
import { map } from 'rxjs/operators/map'
import { tap } from 'rxjs/operators/tap'
import { Query } from '../../interface'
import { mapFn } from './mapFn'
import diff, { Ops } from '../../utils/diff'

export class ProxySelector<T> {

  public request$: Observable<T[]>
  public lastEmit: T[] = []

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
    return this.mapFn(this.request$.pipe(
      tap((data: T[]) => this.lastEmit = data)
    ))
  }

  getLastEmit(): T[] {
    return this.lastEmit
  }

  changesWithOps(pk?: string): Observable<{ result: T[], ops: Ops}>  | never {
    return this.request$.pipe(
      map((result: T[]) => {
        const ops = diff(this.lastEmit || [], result, pk)
        return { result, ops }
      }),
    )
  }

  map<K>(fn: OperatorFunction<T[], K[]>) {
    this.mapFn = fn
    return this as any as ProxySelector<K>
  }
}
