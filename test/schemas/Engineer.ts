import { Database, RDBType, Relationship, ProgramSchema } from '../index'

export interface EngineerSchema {
  _id: string
  name: string
  leadProgram?: ProgramSchema[]
}

export default (db: Database) =>
  db.defineSchema<EngineerSchema>('Engineer', {
    _id: {
      type: RDBType.STRING,
      primaryKey: true,
    },
    name: {
      type: RDBType.STRING,
    },
    leadProgram: {
      type: Relationship.oneToMany,
      virtual: {
        name: 'Program',
        where(table) {
          return {
            _id: table.ownerId,
          }
        },
      },
    },
  })
