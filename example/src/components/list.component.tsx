import * as React from 'react'

import { source, Todo } from '../controller'
import { useObservable } from '../hooks'
import { TodoItem } from './item.component'

interface TodoListProps {
  onRemove: (todo: Todo) => void
  onToggle: (todo: Todo) => void
  onUpdate: (todo: Todo) => void
}

export const TodoList = React.memo((props: TodoListProps) => {
  const todos = useObservable(source.todo, [])

  const items = todos.map((item) => {
    return (
      <TodoItem
        key={ item.id }
        todo={ item }
        onRemove={ props.onRemove }
        onToggle={ props.onToggle }
        onUpdate={ props.onUpdate }
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
