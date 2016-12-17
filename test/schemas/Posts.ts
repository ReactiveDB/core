import { Database, RDBType } from '../index'

export interface PostSchema {
  _id: string
  name: string
}

export default Database.defineSchema('Post', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  content: {
    type: RDBType.BOOLEAN
  }
})
