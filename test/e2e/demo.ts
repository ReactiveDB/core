import { RDBType, DataStoreType } from '../index'
import { Database } from '../../src/storage/Database'

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

const database = new Database(DataStoreType.MEMORY, true, 'todo', 1)
database.defineSchema('Todo', TodoSchema)
database.connect()

let uid = 0
export const nextUid = () => uid++

class TodoController {
  constructor() {
    // this.addItem('Salut')
    // this.addItem('les gens')
    // this.addItem('hi')
    // this.addItem('what')
    // this.addItem('what2')
  }

  addItem(title: string) {
    database.insert('Todo', {
      id: nextUid(),
      title,
      completed: false
    })
      .subscribe()
  }

  removeItem(todo: Todo) {
    database.remove('Todo', { where: { id: todo.id } }).subscribe()
  }

  updateTitle(todo: Todo) {
    database.upsert('Todo', todo).subscribe()
  }

  toggleItem(item: Todo) {
    const raw = { ...item, completed: !item.completed }
    database.upsert('Todo', raw).subscribe()
  }
}

const qt = database
  .get<Todo>('Todo', { limit: 2, skip: 0 })

const qt2 = database
  .get<Todo>('Todo', { limit: 2, skip: 2 })

const qt3 = database
  .get<Todo>('Todo', { limit: 2, skip: 4 })

setTimeout(() => {
  const sub1 = qt.traces('id')
  sub1.subscribe((data) => {
    console.info('sub1', data)
    console.table(data.result)
  })

  setTimeout(() => {
    const sub2 = qt.concat(qt2, qt3)

    sub2
      .traces('id')
      .subscribe((data) => {
        console.info('sub2', data)
        console.table(data.result)
      })
  }, 200)

}, 200)

export const todoController = new TodoController()
self['todoController'] = todoController
