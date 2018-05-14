import { TeambitionTypes, Database, RDBType } from '../index'

export interface TestSchema {
  _id: string
  name: string
  taskId: TeambitionTypes.TaskId
}

export const TestFixture2 = (db: Database) => {
  const schema = {
    _id: {
      type: RDBType.STRING,
      primaryKey: true,
      as: 'id'
    },
    data1: {
      type: RDBType.ARRAY_BUFFER,
    },
    data2: {
      type: RDBType.NUMBER
    },
    data3: {
      type: RDBType.OBJECT
    },
    data4: {
      type: RDBType.INTEGER
    },
    data5: {
      type: RDBType.LITERAL_ARRAY
    },
    data6: {
      type: 1000 as RDBType
    }
  }

  return db.defineSchema('Fixture2', schema)
}
