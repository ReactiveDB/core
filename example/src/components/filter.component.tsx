import * as React from 'react'
import cx from 'classnames'

import { source, FilterOptions } from '../controller'
import { useObservable } from '../hooks'

export const Filter = React.memo((props: { onFilter: (option: FilterOptions) => void }) => {
  const filter = useObservable(source.filter, 'all')

  const setAll = () => props.onFilter('all')
  const setActive = () => props.onFilter('active')
  const setCompleted = () => props.onFilter('completed')

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
