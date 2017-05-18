import { Observable } from 'rxjs/Observable'

export const mapFn = <U>(dist$: Observable<U[]>) => dist$

mapFn.toString = () => 'RDB_DEFAULT_MAP_FN'
