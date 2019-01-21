import * as React from 'react'

import { TodoList, Filter, Header } from './components'

export const TodoMVC = () => {
  return (
    <>
      <Header />
      <TodoList />
      <Filter />
    </>
  )
}

// onRemove={ controller.removeItem }
// onToggle={ controller.toggleItem }
// onUpdate={ controller.updateTitle }
