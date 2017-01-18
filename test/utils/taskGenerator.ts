import * as moment from 'moment'
import { TaskSchema } from '../index'
import { uuid } from './uuid'
import subtaskGenerator from './subtaskGenerator'
import postGenerator from './postGenerator'
import { randomNumber, random } from './random'
import { generateInvolveMembers } from './involveMembersGenerator'

export default function (limit: number) {
  const result: TaskSchema[] = []
  while (limit > 0) {
    limit --
    const _id = uuid()
    const _projectId = uuid()
    const _stageId = uuid()
    const _creatorId = uuid()
    const _executorId = random(20) ? uuid() : _creatorId
    const involves = [ _executorId ]
    if (_creatorId !== _executorId) {
      involves.push(_creatorId)
    }
    const subtasks = subtaskGenerator(randomNumber(1, 20), _id)
    result.push({
      _id, _projectId,
      _stageId, _creatorId,
      _executorId,
      _tasklistId: uuid(),
      _sourceId: null,
      accomplished: null,
      subtasks,
      subtasksCount: subtasks.length,
      content: 'content: ' + uuid(),
      note: 'note: ' + uuid(),
      project: {
        _id: _projectId,
        name: 'project name: ' + uuid(),
        isArchived: true,
        posts: postGenerator(5, _projectId)
      },
      involveMembers: generateInvolveMembers(15, involves),
      created: moment().add(6 - randomNumber(0, 12), 'month').add(30 - randomNumber(0, 30), 'day').toISOString()
    })
  }
  return result
}
