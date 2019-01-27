import * as React from 'react'

import { TodoList, Filter, Header, GtaItem } from './components'
import { controller, source } from './controller'
import { useObservable } from './hooks'

export const TodoMVC = () => {
  const gta = <GtaItem />
  const todos = useObservable(source.todo, [])
  const filter = useObservable(source.filter, 'all')

  return (
    <>
      {/* <TodoContext.Provider value={ controller }> */}
        {/* { gta } */}
        <Header onAdd={ controller.addItem } />
        <TodoList
          todos={ todos }
          toggleItem={ controller.toggleItem }
          removeItem={ controller.removeItem }
          updateTitle={ controller.updateTitle }
        />
        <Filter current={ filter } setFilter={ controller.setFilter } />
      {/* </TodoContext.Provider> */}
    </>
  )
}
