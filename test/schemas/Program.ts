import { Database, RDBType, Association } from '../index'

export interface ProgramSchema {
  _id: string
  ownerId: string
  owner?: Object
  modules?: Object[]
}

export default (db: Database) => db.defineSchema('Program', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  ownerId: {
    type: RDBType.STRING
  },
  owner: {
    type: Association.oneToOne,
    virtual: {
      name: 'Engineer',
      where: (
        engineerTable: lf.schema.Table
      ) => ({
        ownerId: engineerTable['_id']
      })
    }
  },
  modules: {
    type: Association.oneToMany,
    virtual: {
      name: 'Module',
      where: (
        moduleTable: lf.schema.Table
      ) => ({
        _id: moduleTable['parentId']
      })
    }
  }
})
