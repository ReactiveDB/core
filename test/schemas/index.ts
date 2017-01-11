import { Database } from '../index'

import ActivitySelectMeta from './Activity'
import ProjectSelectMetadata from './Project'
import SubtaskSelectMetadata from './Subtask'
import TaskSelectMetadata from './Task'
import PostSelectMetadata from './Posts'

export default (db: Database) => {
  ActivitySelectMeta(db)
  ProjectSelectMetadata(db)
  SubtaskSelectMetadata(db)
  TaskSelectMetadata(db)
  PostSelectMetadata(db)
}

export { ActivitySchema } from './Activity'
export { ProjectSchema } from './Project'
export { PostSchema } from './Posts'
export { SubtaskSchema } from './Subtask'
export { TaskSchema } from './Task'
export { TestSchema, TestFixture, TestFixture2 } from './Test'
