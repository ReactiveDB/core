import { RDBType } from 'reactivedb'

export type FilterOptions = 'all' | 'completed' | 'active'

export interface Todo {
  id: number
  title: string
  completed: boolean
}

export const TodoSchema = {
  id: {
    type: RDBType.NUMBER,
    primaryKey: true,
  },
  title: {
    type: RDBType.STRING,
  },
  completed: {
    type: RDBType.BOOLEAN,
  },
}
