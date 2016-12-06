'use strict'
import { TeambitionTypes, Database, RDBType } from '../index'

export interface TestSchema {
  _id: string
  name: string
  taskId: TeambitionTypes.TaskId
}

export default Database.defineSchema('Test', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  name: {
    type: RDBType.STRING
  },
  taskId: {
    type: RDBType.STRING
  }
})
