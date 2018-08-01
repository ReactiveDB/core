import { TeambitionTypes, Database, RDBType } from '../index'

export interface SubtaskSchema {
  _id: TeambitionTypes.SubtaskId
  content: string
  _taskId: TeambitionTypes.TaskId
  isDone: boolean
  created: string
}

export default (db: Database) =>
  db.defineSchema<SubtaskSchema>('Subtask', {
    _id: {
      type: RDBType.STRING,
      primaryKey: true,
    },
    content: {
      type: RDBType.STRING,
    },
    _taskId: {
      type: RDBType.STRING,
      index: true,
    },
    isDone: {
      type: RDBType.BOOLEAN,
    },
    created: {
      type: RDBType.DATE_TIME,
    },
  })
