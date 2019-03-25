import { useEffect, useState } from 'react'
import { BehaviorSubject, Observable, merge, of, timer } from 'rxjs'
import { scan, tap, filter, map, switchMap } from 'rxjs/operators'
import { Action } from 'rxjs/internal/scheduler/Action';

interface States<T> {
  isLoading: boolean
  term: string
  recommands: T[]
  options: T[]
  searchedOptions: T[]
}

interface SelectorStates<T> {
  states: States<T>,
  handler: SelectorHanlder
}

interface Endpoints {
  search: string
  recommand: string
}

interface SelectorHanlder {
  onSubmit: () => void
  onSearch: (value: string) => void
  onToggle: (value: any) => void
}

enum Command {
  Init = 1000,
  Toggle,
  Search,
  Submit,
  Reset
}

export function useSelector<T>() {
  const [ initialValue, setValue ] = useState<SelectorStates<T> | null>(null)

  useEffect(() => {
    const state$ = new BehaviorSubject<{ type: Command, payload: any }>({
      type: Command.Init,
      payload: {
        isLoading: true,
        term: '',
        recommands: [],
        options: [],
        searchedOptions: []
      }
    })

    const init$ = state$.pipe(
      filter((cmd) => cmd.type === Command.Init),
      switchMap((cmd) => {
        const range = Math.floor(Math.random() * 10)
        const o: any[] = []
        for(let i = 0; i < range; i++) {
          o.push(i)
        }
        const p = timer(500).pipe(map(() => ({ payload: { recommands: o, isLoading: false } })))
        return merge(of({
          payload: cmd.payload,
          isLoading: true
        }), p)
      })
    )

    const search$ = state$.pipe(
      filter((cmd) => cmd.type === Command.Search),
      switchMap((cmd) => {
        const range = Math.floor(Math.random() * 10)
        const o: any[] = []
        for(let i = 0; i < range; i++) {
          o.push(i)
        }
        const p = timer(1000).pipe(map(() => ({ payload: { searchedOptions: o, isLoading: false } })))
        return merge(of({
          payload: {
            term: cmd.payload,
            searchedOptions: [],
            isLoading: true
          }
        }), p)
      })
    )

    const submit$ = state$.pipe(filter((cmd) => cmd.type === Command.Submit))

    const toggle$ = state$.pipe(
      filter((cmd) => cmd.type === Command.Toggle),
      scan((acc, curr: any) => {
        const options: any[] = acc
        const index = options.indexOf(curr.payload)
        if (index > -1) {
          return options.filter(i => i !== curr.payload)
        }
        return options.concat(curr.payload)
      }, state$.getValue().payload.options),
      map((v) => ({
        payload: { term: '', options: v }
      }))
    )

    const subs = merge(init$, search$, submit$, toggle$)
      .pipe(
        // tap((v) => console.info(v)),
        scan((acc, curr) => {
          const newPayload = {
            ...acc.payload,
            ...curr.payload
          }
          return { type: Command.Reset, payload: newPayload }
        }),
        map((payload) => payload.payload)
      )
      .subscribe((v) => {
        const onToggle: any = (value: T) => {
          state$.next({ type: Command.Toggle, payload: value as any })
        }

        const onSearch: any = (value: string) => {
          state$.next({ type: Command.Search, payload: value })
        }

        setValue({
          states: v,
          handler: {
            onToggle: onToggle,
            onSearch: onSearch,
            onSubmit: onToggle
          }
        })
      })

    return () => subs.unsubscribe()
  }, [])

  return initialValue
}
