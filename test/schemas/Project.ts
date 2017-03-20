import { TeambitionTypes, Database, RDBType, Relationship, PostSchema } from '../index'

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
    type: Relationship.oneToMany,
    virtual: {
      name: 'Post',
      where: (ref: PostSchema) => ({
        _id: ref.belongTo
      })
    }
  }
})
