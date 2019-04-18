import { RDBType, DataStoreType } from '../index'
import { Database } from '../../src/storage/Database'

// import { tap } from 'rxjs/operators'

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
    this.addItem('Salut')
    this.addItem('les gens')
    this.addItem('hi')
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

// const db1 = database
//   .get<Todo>('Todo', { limit: 2, skip: 0 })

// console.info(db1)

// const db2 = database
//   .get<Todo>('Todo', { limit: 4, skip: 2 })
//
// const db3 = database
//   .get<Todo>('Todo', { limit: 4, skip: 6 })

// console.info(db2)

// db1.concat(db2, db3)
//   .changes()
//   .pipe(
//     tap(data => console.table(data)),
//     scan((prev, cur) => {
//       console.info('scan', prev, cur)
//       return cur
//     }),
//   )
//   .subscribe()

// database
//   .get<Todo>('Todo', { where: { id: { $lt: 2 } } })
//   .changes()
//   .subscribe(data => {
//     console.table(data)
//   })

const qt = database
  .get<Todo>('Todo', { limit: 2, skip: 0 })

const qt2 = database
  .get<Todo>('Todo', { limit: 2, skip: 2 })

const qt3 = database
  .get<Todo>('Todo', { limit: 2, skip: 4 })

const sub1 = qt.changes()

setTimeout(() => {
  sub1.subscribe((data) => {
    console.info('sub1', data)
    console.table(data)
  })

  setTimeout(() => {
    const sub2 = qt.concat(qt2, qt3)

    sub2
      .changes()
      .subscribe((data) => {
        console.info('sub2', data)
        console.table(data)
      })
  }, 200)

}, 200)

export const todoController = new TodoController()
self['todoController'] = todoController
