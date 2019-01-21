import * as React from 'react'

import { controller } from './controller'
import { TodoList, Filter, Header } from './components'

export const TodoMVC = () => {
  return (
    <>
      <Header onAdd={ controller.addItem } />
      <TodoList
        onRemove={ controller.removeItem }
        onToggle={ controller.toggleItem }
        onUpdate={ controller.updateTitle }
      />
      <Filter onFilter={ controller.setFilter } />
    </>
  )
}
