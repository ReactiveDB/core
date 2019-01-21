import * as React from 'react'
import { useState, useContext } from 'react'
import cx from 'classnames'

import { Todo, TodoContext } from '../controller'

export interface TodoItemProps{
  todo: Todo
}

export interface TodoItemState {
  editing: boolean
  title: string
}

export const TodoItem = React.memo((props: TodoItemProps) => {
  const { todo } = props
  const context = useContext(TodoContext)
  const [ state, setState ] = useState<TodoItemState>({ editing: false, title: '' })
  const { editing, title } = state

  const cls = cx({ completed: todo.completed, editing })

  const toggle = () => {
    context.toggleItem(todo)
  }

  const remove = () => {
    context.removeItem(todo)
  }

  const startEditing = () => {
    setState({editing: true, title: todo.title})
  }

  const submit = () => {
    context.updateTitle({ ...todo, title })
    setState({ editing: false, title })
  }

  const keyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Escape':
        setState({ editing: false, title: todo.title })
        break
      case 'Enter':
        submit()
        break
    }
  }

  const onInput = (e: React.SyntheticEvent<HTMLInputElement>) => {
    const target = e.target as HTMLInputElement
    setState({ editing: true, title: target.value })
  }

  return (
    <li className={ cls }>
      <div className='view'>
        <input
          className='toggle'
          type='checkbox'
          onChange={ toggle }
          checked={ todo.completed }
        />
        <label onDoubleClick={ startEditing }>
          { todo.title }
        </label>
        <button className='destroy' onClick={ remove }></button>
      </div>
      <input
        className='edit'
        type='text'
        value={ title }
        onBlur={ submit }
        onKeyDown={ keyDown }
        onChange={ onInput }
       />
    </li>
  )
})
