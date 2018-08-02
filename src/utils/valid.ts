import { throwError, Observable, EMPTY } from 'rxjs'
import { skip } from 'rxjs/operators'

// think it as asynchronous assert
export function valid<T>(condition: any, error: Error): Observable<never> | Observable<T> {
  if (!condition) {
    return throwError(error)
  }

  return EMPTY.pipe(skip(1))
}
