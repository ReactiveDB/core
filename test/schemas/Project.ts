import { TeambitionTypes, Database, RDBType, Relationship, OrganizationSchema } from '../index'

export interface ProjectSchema {
  _id: TeambitionTypes.ProjectId
  _organizationId: TeambitionTypes.OrganizationId
  name: string
  isArchived: boolean
  posts: any[]
  organization: OrganizationSchema
}
export default (db: Database) => db.defineSchema<ProjectSchema>('Project', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  _organizationId: {
    type: RDBType.STRING
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
      where: ref => ({
        _id: ref.belongTo
      })
    }
  },
  organization: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Organization',
      where: ref => ({
        _organizationId: ref._id
      })
    }
  }
})
