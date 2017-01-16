import { Database, RDBType, Association } from '../index'

export interface EngineerSchema {
  _id: string
  name: string
  leadProgram?: Object[]
}

export default (db: Database) => db.defineSchema('Engineer', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  name: {
    type: RDBType.STRING
  },
  leadProgram: {
    type: Association.oneToMany,
    virtual: {
      name: 'Program',
      where: (programTable: lf.schema.Table) => ({
        _id: programTable['ownerId']
      })
    }
  }
})
