import { Database, RDBType, Relationship } from '../index'
import { ProjectSchema } from './index'

export interface TasklistSchema {
  _id: string
  _projectId: string
  name: string
  project: ProjectSchema
}

export default (db: Database) => db.defineSchema<TasklistSchema>('Tasklist', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  _projectId: {
    type: RDBType.STRING
  },
  name: {
    type: RDBType.STRING
  },
  project: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Project',
      where: projectTable => ({
        _projectId: projectTable._id
      })
    }
  }
})
