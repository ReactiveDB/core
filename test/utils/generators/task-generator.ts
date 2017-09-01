import * as moment from 'moment'
import { TaskSchema } from '../../index'
import { uuid } from '../uuid'
import * as random from '../random'
import subtaskGen from './subtask-generator'
import postGen from './post-generator'
import involveMembersGen from './involved-members-generator'

export default function (limit: number) {
  const result: TaskSchema[] = []
  while (limit > 0) {
    limit --
    const _id = uuid()
    const _projectId = uuid()
    const _stageId = uuid()
    const _creatorId = uuid()
    const _organizationId = uuid()
    const _tasklistId = uuid()
    const _executorId = random.rnd(20) ? uuid() : _creatorId
    const involves = [ _executorId ]
    if (_creatorId !== _executorId) {
      involves.push(_creatorId)
    }
    const subtasks = subtaskGen(random.number(1, 20), _id)
    const project = {
      _id: _projectId,
      name: 'project name: ' + uuid(),
      isArchived: true,
      posts: postGen(5, _projectId),
      _organizationId: _organizationId,
      organization: {
        _id: _organizationId,
        name: 'organization name: ' + uuid(),
        isArchived: false,
      }
    }
    result.push({
      _id, _projectId,
      _stageId, _creatorId,
      _executorId,
      _tasklistId,
      _sourceId: null,
      accomplished: null,
      subtasks,
      subtasksCount: subtasks.length,
      content: 'content: ' + uuid(),
      note: 'note: ' + uuid(),
      tasklist: {
        _id: _tasklistId,
        name: 'tasklist name' + uuid(),
        _projectId,
        project
      },
      project,
      involveMembers: involveMembersGen(15, involves),
      created: moment().add(6 - random.number(0, 12), 'month').add(30 - random.number(0, 30), 'day').toISOString()
    })
  }

  return result
}
