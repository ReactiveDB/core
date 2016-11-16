'use strict'
import 'rxjs/add/operator/map'
import './schemas/Task'
import './schemas/Subtask'
import './schemas/Project'

import { database$ } from './storage/lovefield'
import Database from './storage/Database'

Database.store('Task', {
  _id: '1111',
  note: 'note',
  content: 'content',
  xxx: 'test xxx',
  project: {
    _id: 'haha',
    name: 'xxx'
  }
})
  .subscribe(r => {
    console.log(111, r)
  }, err => {
    console.error(err)
  })

// setTimeout(() => {
//   Database.update('Task', '1111', {
//     content: '2222'
//   })
//     .subscribe(r => {
//       console.log(r)
//     })
// }, 1000)

