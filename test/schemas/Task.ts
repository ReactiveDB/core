import * as lf from 'lovefield'
import { RDBType, Association } from '../index'
import { TeambitionTypes, Database, SubtaskSchema } from '../index'

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
  project?: {
    _id: TeambitionTypes.ProjectId
    name: string,
    isArchived: boolean
  }
  subtasks: SubtaskSchema[]
  created: string,
  involveMembers: string[]
}

export default Database.defineSchema('Task', {
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
    type: RDBType.STRING,
    unique: true
  },
  note: {
    type: RDBType.STRING
  },
  project: {
    type: Association.oneToOne,
    virtual: {
      name: 'Project',
      where: (
        projectTable: lf.schema.Table,
        taskTable: lf.schema.Table
      ) => {
        return projectTable['_id'].eq(taskTable['_projectId'])
      }
    }
  },
  subtasks: {
    type: Association.oneToMany,
    virtual: {
      name: 'Subtask',
      where: (subtaskTable: lf.schema.Table, taskTable: lf.schema.Table) => {
        return subtaskTable['_taskId'].eq(taskTable['_id'])
      }
    }
  },
  involveMembers: {
    type: RDBType.OBJECT
  },
  created: {
    type: RDBType.DATE_TIME
  }
})

Database.defineHook('Task', {
  destroy(db, entity) {
    const subtaskTable = db.getSchema().table('Subtask')
    return db.delete()
      .from(subtaskTable)
      .where(subtaskTable['taskId'].eq(entity._id))
  }
})
