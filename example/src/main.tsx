import * as React from 'react'
import { render } from 'react-dom'

import { TodoMVC } from './TodoMVC'

render(
  <section className='todoapp'>
    <TodoMVC />
  </section>,
  document.getElementById('app') as Element
)
