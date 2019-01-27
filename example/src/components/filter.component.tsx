import * as React from 'react'
import cx from 'classnames'

import { FilterOptions } from '../controller'

export interface FilterProps {
  current: FilterOptions
  setFilter(filter: FilterOptions): void
}

export const Filter = React.memo((props: FilterProps) => {
  const filter = props.current

  const setAll = () => props.setFilter('all')
  const setActive = () => props.setFilter('active')
  const setCompleted = () => props.setFilter('completed')

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
