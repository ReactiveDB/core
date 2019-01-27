import * as React from 'react'

import { Todo } from '../controller'
import { TodoItem } from './item.component'

export interface TodoListProps {
  todos: Todo[]
  toggleItem(todo: Todo): void
  removeItem(todo: Todo): void
  updateTitle(todo: Todo): void
}

export const TodoList = React.memo((props: TodoListProps) => {
  const items = props.todos.map((item) => {
    return (
      <TodoItem
        todo={ item }
        key={ item.id }
        toggleItem={ props.toggleItem }
        removeItem={ props.removeItem }
        updateTitle={ props.updateTitle }
      />
    )
  })

  return (
    <section className='main'>
      <ul className='todo-list'>
        { items }
      </ul>
    </section>
  )
})
