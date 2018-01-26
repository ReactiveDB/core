import { RDBType, SchemaDef, Relationship } from 'reactivedb'
import Database from './Database'

interface BasicSchema {
  _id: string
  _demoId: string
  content: string
  name: string
  color: string
  avatar: {
    url: string
    preview: string
  }
  demo: {
    _id: string
    name: string
    isDone: boolean
  }
}

interface DemoSchema {
  _id: string
  _otherId: string
  basicIds: string[]
  basics: BasicSchema[]
  other: {
    _id: string
    basic: {
      _id: string
      name: string
      avatar: {
        url: string
        preview: string
      }
    }
  }
  name: string
  isDone: boolean
  order: number
}

interface OtherSchema {
  _id: string
  _basicId: string
  basic: Partial<BasicSchema>
  content: string
  fields: string[]
  startDate: string
  endDate: string
}

const basicSchema: SchemaDef<BasicSchema> = {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  _demoId: {
    type: RDBType.STRING,
    index: true
  },
  color: {
    type: RDBType.STRING
  },
  content: {
    type: RDBType.STRING
  },
  name: {
    type: RDBType.STRING
  },
  avatar: {
    type: RDBType.OBJECT
  },
  demo: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Demo',
      where: demoTable => ({
        _demoId: demoTable._id
      })
    }
  }
}

const demoSchema: SchemaDef<DemoSchema> = {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  _otherId: {
    type: RDBType.STRING
  },
  basicIds: {
    type: RDBType.LITERAL_ARRAY
  },
  basics: {
    type: Relationship.oneToMany,
    virtual: {
      name: 'Basic',
      where: basicTable => ({
        _id: basicTable._demoId
      })
    }
  },
  other: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Other',
      where: otherTable => ({
        _otherId: otherTable._id
      })
    }
  },
  name: {
    type: RDBType.STRING
  },
  isDone: {
    type: RDBType.BOOLEAN
  },
  order: {
    type: RDBType.NUMBER
  }
}

const otherSchema: SchemaDef<OtherSchema> = {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  _basicId: {
    type: RDBType.STRING
  },
  basic: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Basic',
      where: basicTable => ({
        _basicId: basicTable._id
      })
    }
  },
  content: {
    type: RDBType.STRING
  },
  fields: {
    type: RDBType.ARRAY_BUFFER
  },
  startDate: {
    type: RDBType.DATE_TIME
  },
  endDate: {
    type: RDBType.DATE_TIME
  }
}

Database.defineSchema('Basic', basicSchema)
Database.defineSchema('Demo', demoSchema)
Database.defineSchema('Other', otherSchema)


Database.connect()
