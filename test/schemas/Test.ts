'use strict'
import { TeambitionTypes, Database, RDBType } from '../index'

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
          projectTable: lf.schema.Table,
          taskTable: lf.schema.Table
        ) => {
          return projectTable['_id'].eq(taskTable['_projectId'])
        }
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

  Database.defineSchema('Test', schema)
}

export const TestFixture2 = () => {
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

  Database.defineSchema('Test', schema)
}
