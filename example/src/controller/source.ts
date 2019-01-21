import { incremental as incr } from 'reactivedb'
import { BehaviorSubject } from 'rxjs'
import { shareReplay, switchMap } from 'rxjs/operators'

import { FilterOptions, Todo } from './schema'
import { database } from './database'

export const filterSubject = new BehaviorSubject<FilterOptions>('all')
const filter$ = filterSubject.pipe(shareReplay(1))

export const source = {
  filter: filter$,
  todo: filter$.pipe(
    switchMap<FilterOptions, Todo[]>((filter) => {
      switch (filter) {
        case 'active':
          return database.get<Todo>('Todo', { where: { completed: false } }).changes()
        case 'completed':
          return database.get<Todo>('Todo', { where: { completed: true } }).changes()
        default:
          return database.get<Todo>('Todo').changes()
      }
    }),
    incr(),
  ),
}
