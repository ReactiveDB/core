'use strict'
import { TeambitionTypes, Database, RDBType, Association } from '../index'
import { ProjectSchema } from './Project'

export interface TestSchema {
  _id: string
  name: string
  taskId: TeambitionTypes.TaskId
}

export const TestFixture = (enableAliasConfict = false) => {
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
      type: RDBType.STRING,
      virtual: {
        name: 'Project',
        where: (
          projectTable: lf.schema.Table & ProjectSchema
        ) => ({
          _projectId: projectTable._id
        })
      }
    },
    data4: {
      type: RDBType.OBJECT
    },
    data5: {
      type: RDBType.INTEGER
    }
  }

  if (enableAliasConfict) {
    schema.data2['as'] = 'id'
  }

  return (db: Database) => db.defineSchema('Fixture1', schema)
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

export default (db: Database) => {
  const schema = {
    id: {
      type: RDBType.STRING,
      primaryKey: true
    },
    data1: {
      type: RDBType.NUMBER
    },
    data2: {
      type: Association.oneToMany,
      virtual: {
        name: 'Project',
        where: (
          projectTable: lf.schema.Table,
        ) => ({
          id: projectTable['_id']
        })
      }
    }
  }

  return db.defineSchema('Test', schema)
}
