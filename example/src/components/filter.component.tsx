import * as React from 'react'
import { useContext } from 'react'
import cx from 'classnames'

import { source, TodoContext } from '../controller'
import { useObservable } from '../hooks'

export const Filter = React.memo(() => {
  const filter = useObservable(source.filter, 'all')
  const context = useContext(TodoContext)

  const setAll = () => context.setFilter('all')
  const setActive = () => context.setFilter('active')
  const setCompleted = () => context.setFilter('completed')

  const handlers = [
    {
      href: '#/',
      className: cx({ selected: filter === 'all' }),
      onClick: setAll,
      children: 'All'
    },
    {
      href: '#/active',
      className: cx({ selected: filter === 'active' }),
      onClick: setActive,
      children: 'Active'
    },
    {
      href: '#/completed',
      className: cx({ selected: filter === 'completed' }),
      onClick: setCompleted,
      children: 'Complete'
    }
  ]

  const items = handlers.map((item) => {
    return (
      <li key={ item.href }>
        <a { ...item } />
      </li>
    )
  })

  return (
    <footer className='footer'>
      <ul className="filters">
        { items }
      </ul>
    </footer>
  )
})
