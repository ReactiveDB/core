import { TeambitionTypes, Database, RDBType, Association } from '../index'

export interface ProjectSchema {
  _id: TeambitionTypes.ProjectId
  name: string
}
export default (db: Database) => db.defineSchema('Project', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  name: {
    type: RDBType.STRING
  },
  isArchived: {
    type: RDBType.BOOLEAN
  },
  posts: {
    type: Association.oneToMany,
    virtual: {
      name: 'Post',
      where: (
        postTable: lf.schema.Table
      ) => ({
        _id: postTable['belongTo']
      })
    }
  }
})

// waiting for next lovefield release
/**
  posts: {
    type: Association.oneToMany,
    virtual: {
      name: 'Post',
      where: (
        postTable: lf.schema.Table,
        projectTable: lf.schema.Table
      ) => {
        return postTable['belongTo'].eq(projectTable['_id'])
      }
    }
  }
 */
