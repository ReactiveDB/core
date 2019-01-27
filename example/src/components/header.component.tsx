import * as React from 'react'
import { useState } from 'react'

export interface HeaderProps {
  onAdd(title: string): void
}

export const Header = (props: HeaderProps) => {
  const [ newItem, setValue ] = useState('')

  const onInput = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    setValue(target.value)
  }

  const onAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    if (e.key === 'Enter' && target.value.trim() !== '') {
      props.onAdd(target.value)
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
