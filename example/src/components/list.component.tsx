import * as React from 'react'

import { source } from '../controller'
import { useObservable } from '../hooks'
import { TodoItem } from './item.component'

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
