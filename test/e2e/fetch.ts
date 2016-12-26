import 'rxjs/observable/dom/ajax'
import { Observable, Scheduler } from 'rxjs'
import { database } from './database'
import { TaskSchema } from '../schemas/Task'

Observable.ajax({
  url: `http://project.ci/api/v2/tasks/me/?count=500&isDone=false&page=1`,
  withCredentials: true,
  crossDomain: true
})
  .map(r => {
    console.time('Task insert')
    return r.response
  })
  .concatMap(r => database.insert('Task', r))
  .concatMap(() => {
    console.timeEnd('Task insert')
    return Observable.ajax({
      url: `http://project.ci/api/v2/tasks/me/subtasks?count=500&isDone=false&page=1`,
      withCredentials: true,
      crossDomain: true
    })
  })
  .map(r => r.response)
  .concatMap(r => database.insert('Subtask', r))
  .do(() => {
    database.insert('Subtask', {
      _id: 1,
      content: 'foo',
      _taskId: '56cfbabb981fbfc92eb8f517',
      isDone: true,
      created: new Date().toISOString()
    })
  })
  .do(() => {
    database.update('Project', '584172991548501c664fb6e2', {
      name: 'updated task project'
    })
    .subscribeOn(Scheduler.asap, 2000)
    .subscribe(() => {
      console.time('Tasks change notify')
    })
  })
  .concatMap(() => {
    // database.delete<TaskSchema>('Task', {
    //   where: (table) => table['created'].gte(1)
    // }).subscribe(r => console.log(1111, r))
    // , {
    //   fields: ['_id', {
    //     project: ['_id', {
    //       post: ['_id', 'content']
    //     }]
    //   }]
    // }
    return database.get<TaskSchema>('Task').values()
  })
  .subscribe((_) => {
    console.timeEnd('Tasks change notify')
    // console.log(r)
  }, err => {
    console.error(err)
  })
