import * as lf from 'lovefield'
import { TaskId, StageId, ProjectId } from '../teambition'
import database from '../storage/Database'

export interface TaskSchema {
  _id: TaskId
  content: string
  note: string
  project?: {
    _id: ProjectId
    name: string
  }
}

database.defineTable('Task', {
  _id: {
    type: lf.Type.STRING,
    primaryKey: true
  },
  content: {
    type: lf.Type.STRING
  },
  note: {
    type: lf.Type.STRING
  },
  project: {
    type: lf.Type.OBJECT,
    virtual: {
      name: 'Project',
      fields: ['_id', 'name']
    }
  },
  subtask: {
    type: lf.Type.OBJECT,
    virtual: {
      name: 'Subtask',
      fields: ['_id', 'name']
    }
  }
})
