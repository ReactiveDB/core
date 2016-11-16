'use strict'
import * as lf from 'lovefield'
import { TaskId, SubtaskId } from '../teambition'
import database from '../storage/Database'

export interface SubtaskSchema {
  _id: SubtaskId
  name: string
  taskId: string
}

database.defineTable('Subtask', {
  _id: {
    type: lf.Type.STRING,
    primaryKey: true
  },
  name: {
    type: lf.Type.STRING
  },
  taskId: {
    type: lf.Type.STRING
  }
})
