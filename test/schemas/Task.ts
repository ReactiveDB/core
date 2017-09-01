import { RDBType, Relationship } from '../index'
import { TeambitionTypes, Database, SubtaskSchema, ProjectSchema, TasklistSchema } from '../index'

export interface TaskSchema {
  _id: TeambitionTypes.TaskId
  _creatorId: string
  _executorId: string
  content: string
  note: string
  _sourceId?: string
  _projectId: TeambitionTypes.ProjectId
  _stageId: TeambitionTypes.StageId
  _tasklistId: TeambitionTypes.TasklistId
  accomplished: string
  project?: ProjectSchema
  tasklist: TasklistSchema
  subtasks: SubtaskSchema[]
  subtasksCount: number
  created: string,
  involveMembers: string[]
}

export default (db: Database) => {
  db.defineSchema<TaskSchema>('Task', {
    _creatorId: {
      type: RDBType.STRING
    },
    _executorId: {
      type: RDBType.STRING
    },
    _projectId: {
      type: RDBType.STRING
    },
    _id: {
      type: RDBType.STRING,
      primaryKey: true
    },
    _sourceId: {
      type: RDBType.STRING
    },
    _stageId: {
      type: RDBType.STRING,
      index: true
    },
    _tasklistId: {
      type: RDBType.STRING
    },
    accomplished: {
      type: RDBType.STRING
    },
    content: {
      type: RDBType.STRING
    },
    note: {
      type: RDBType.STRING
    },
    project: {
      type: Relationship.oneToOne,
      virtual: {
        name: 'Project',
        where: ref => {
          return {
            _projectId: ref._id
          }
        }
      }
    },
    tasklist: {
      type: Relationship.oneToOne,
      virtual: {
        name: 'Tasklist',
        where: ref => ({
          _tasklistId: ref._id
        })
      }
    },
    subtasks: {
      type: Relationship.oneToMany,
      virtual: {
        name: 'Subtask',
        where: ref => {
          return {
            _id: ref._taskId
          }
        }
      }
    },
    subtasksCount: {
      type: RDBType.NUMBER
    },
    involveMembers: {
      type: RDBType.LITERAL_ARRAY
    },
    created: {
      type: RDBType.DATE_TIME
    },
    dispose: (rootEntities, scope) => {
      const [ matcher, disposer ] = scope('Subtask')
      return matcher({ _taskId: { $in: rootEntities.map((entity: any) => entity._id) } }).do(disposer)
    }
  })
}
