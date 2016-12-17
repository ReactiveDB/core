'use strict'
import { TeambitionTypes, Database, RDBType } from '../index'

export interface TestSchema {
  _id: string
  name: string
  taskId: TeambitionTypes.TaskId
}

export const TestFixture = () =>
  Database.defineSchema('Test', {
    _id: {
      type: RDBType.STRING,
      primaryKey: true,
      as: 'id'
    },
    name: {
      type: RDBType.STRING,
      as: 'id'
    },
    taskId: {
      type: RDBType.STRING
    }
  })
