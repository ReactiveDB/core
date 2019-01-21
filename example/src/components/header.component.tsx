import * as React from 'react'
import { useState, useContext } from 'react'

import { TodoContext } from '../controller'

export const Header = () => {
  const [ newItem, setValue ] = useState('')
  const context = useContext(TodoContext)

  const onInput = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    setValue(target.value)
  }

  const onAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    if (e.key === 'Enter') {
      context.addItem(target.value)
      setValue('')
    }
  }

  return (
    <header className='header'>
      <h1>todos</h1>
      <input
        className='new-todo'
        value={ newItem }
        placeholder='What needs to be done?'
        onKeyPress={ onAdd }
        onChange={ onInput }
      />
    </header>
  )
}
