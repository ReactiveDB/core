import { Observable } from 'rxjs/Observable'

// think it as asynchronous assert
export function valid<T>(condition: any, error: Error) {
  if (!condition) {
    return Observable.throw(error)
  }

  return Observable.empty<T>().skip(1)
}
