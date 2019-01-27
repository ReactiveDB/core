import * as React from 'react'

const todoGta = {
  onClick() {
    console.info('gta click')
  },
  onchange() {
    console.info('gta change')
  }
}
export const TodoGTA = React.createContext<typeof todoGta>(todoGta)
