import 'rxjs/observable/dom/ajax'
import { Observable } from 'rxjs/Observable'
import { database } from './database'

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
  .concatMap(() => {
    console.time('Task get')
    return database.get('Task').value()
  })
  .subscribe(r => {
    console.timeEnd('Task get')
    console.log(r)
  }, err => {
    console.error(err)
  })
