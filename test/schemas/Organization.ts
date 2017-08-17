import { TeambitionTypes, Database, RDBType } from '../index'

export interface OrganizationSchema {
  _id: TeambitionTypes.OrganizationId
  name: string
  isArchived: boolean
}

export default (db: Database) => db.defineSchema<OrganizationSchema>('Organization', {
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
