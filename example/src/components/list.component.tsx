import * as React from 'react'

import { source } from '../controller'
import { useObservable } from '../hooks'
import { TodoItem } from './item.component'
// import { Todo } from '../schema'

// interface TodoListProps {
//   onRemove: (todo: Todo) => void
//   onToggle: (todo: Todo) => void
//   onUpdate: (todo: Todo) => void
// }

export const TodoList = React.memo(() => {
  const todos = useObservable(source.todo, [])

  const items = todos.map((item) => {
    return (
      <TodoItem
        todo={ item }
        key={ item.id }
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

// onRemove={ props.onRemove }
// onToggle={ props.onToggle }
// onUpdate={ props.onUpdate }
