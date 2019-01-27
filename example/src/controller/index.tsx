import * as React from 'react'

import { FilterOptions, Todo } from './schema'
import { database, nextUid } from './database'
import { filterSubject } from './source'

export class TodoController {

  constructor() {
    this.addItem('Salut')
    this.addItem('les gens')
  }

  setFilter(filter: FilterOptions) {
    filterSubject.next(filter)
  }

  addItem(title: string) {
    database.insert('Todo', {
      id: nextUid(),
      title,
      completed: false
    })
    .subscribe()
  }

  removeItem(todo: Todo) {
    database.remove('Todo', { where: { id: todo.id } }).subscribe()
  }

  updateTitle(todo: Todo) {
    database.upsert('Todo', todo).subscribe()
  }

  toggleItem(item: Todo) {
    const raw = { ...item, completed: !item.completed }
    database.upsert('Todo', raw).subscribe()
  }

  info() {
    console.info('infoinfo')
  }

}

export const controller = new TodoController()
export { source } from './source'
export { Todo, FilterOptions } from './schema'

export const TodoContext = React.createContext<TodoController>(controller)

export const TodoProvider = (props: { children: any }) => {
  return (
    <TodoContext.Provider value={ controller }>
      { props.children }
    </TodoContext.Provider>
  )
}
