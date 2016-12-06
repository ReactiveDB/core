'use strict'
import { TeambitionTypes, Database, RDBType } from '../index'

export interface ProjectSchema {
  _id: TeambitionTypes.ProjectId
  name: string
}
export default Database.defineSchema('Project', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  name: {
    type: RDBType.STRING
  },
  isArchived: {
    type: RDBType.BOOLEAN
  }
})
