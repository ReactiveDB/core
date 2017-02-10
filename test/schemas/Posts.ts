import { Database, RDBType } from '../index'

export interface PostSchema {
  _id: string
  content: string
  belongTo: string
  created: Date
}

export default (db: Database) => db.defineSchema('Post', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  content: {
    type: RDBType.BOOLEAN
  },
  belongTo: {
    type: RDBType.STRING
  },
  created: {
    type: RDBType.DATE_TIME
  }
})
