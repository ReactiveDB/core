import * as React from 'react'
import { render } from 'react-dom'

import { useSelector } from './hooks'

// import { TodoMVC } from './TodoMVC'

function Selector() {
  const controller = useSelector()
  if (!controller) {
    return null
  }

  const onSearch = (e: any) => {
    controller.handler.onSearch(e.target.value)
  }

  const onSubmit = () => {
    controller.handler.onSubmit()
  }

  const onToggle = (o: any) => {
    return () => controller.handler.onToggle(o)
  }

  const isLoading = controller.states.isLoading

  const recs = controller.states.recommands.map((op) =>
    <li key={ op as number } onClick={ onToggle(op) }>{ op }</li>)

  const options = controller.states.options.map((op) =>
    <li key={ op as number } onClick={ onToggle(op) }>{ op }</li>)

  const searched = controller.states.searchedOptions.map((op) =>
    <li key={ op as number } onClick={ onToggle(op) }>{ op }</li>)

  const view = controller.states.term === ''
    ? <>
        <ul>
          { options }
        </ul>
        <section>
          { '推荐列表' }
          <ul>
            { recs }
          </ul>
        </section>
      </>
    : <>
        <section>
          { '搜索列表' }
          <ul>
            { searched }
          </ul>
        </section>
      </>

  return (
    <div>
      <input value={ controller.states.term } onChange={ onSearch } />
      <button onClick={ onSubmit }>Submit</button>
      <div>
        { isLoading ? 'Loading....' : view }
      </div>
    </div>
  )
}

render(
  <Selector />,
  document.getElementById('app') as Element
)
