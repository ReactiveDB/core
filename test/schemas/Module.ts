import { Database, RDBType, Association } from '../index'

export interface ModuleSchema {
  _id: string
  name: string
  ownerId: string
  programmer?: Object
  parentId: string
}

export default (db: Database) => db.defineSchema('Module', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  name: {
    type: RDBType.STRING,
    unique: true
  },
  ownerId: {
    type: RDBType.STRING
  },
  parentId: {
    type: RDBType.STRING
  },
  programmer: {
    type: Association.oneToOne,
    virtual: {
      name: 'Engineer',
      where: (engineerTable: lf.schema.Table) => ({
        ownerId: engineerTable['_id']
      })
    }
  }
})
