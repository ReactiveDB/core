'use strict'
import * as lf from 'lovefield'
import { ProjectId } from '../teambition'
import database from '../storage/Database'

export interface ProjectSchema extends lf.schema.Table {
  _id: ProjectId
  name: string
}

database.defineTable('Project', {
  _id: {
    type: lf.Type.STRING,
    primaryKey: true
  },
  name: {
    type: lf.Type.STRING
  }
})
