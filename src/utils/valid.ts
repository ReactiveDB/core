import { Observable } from 'rxjs/Observable'
import { empty } from 'rxjs/observable/empty'
import { skip } from 'rxjs/operators/skip'
import { ErrorObservable } from 'rxjs/observable/ErrorObservable'

// think it as asynchronous assert
export function valid<T>(condition: any, error: Error): ErrorObservable | Observable<T> {
  if (!condition) {
    return Observable.throw(error)
  }

  return empty<T>().pipe(skip(1))
}
