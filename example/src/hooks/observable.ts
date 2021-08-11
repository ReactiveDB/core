import { useEffect, useState } from 'react'
import { Observable } from 'rxjs'

export function useObservable<T>(source: Observable<T>, initialValue: T) {
  const [initial, setValue] = useState<T>(initialValue)

  useEffect(() => {
    const data$ = source.subscribe(setValue)
    return () => data$.unsubscribe()
  }, [])

  return initial
}
