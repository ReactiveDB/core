import { Observable } from 'rxjs'

export const mapFn = <U>(dist$: Observable<U[]>) => dist$

mapFn.toString = () => 'RDB_DEFAULT_MAP_FN'
