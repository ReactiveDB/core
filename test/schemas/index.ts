import { Database } from '../index'

import ProjectSelectMetadata from './Project'
import SubtaskSelectMetadata from './Subtask'
import TaskSelectMetadata from './Task'
import PostSelectMetadata from './Posts'

export default (db: Database) => {
  ProjectSelectMetadata(db)
  SubtaskSelectMetadata(db)
  TaskSelectMetadata(db)
  PostSelectMetadata(db)
}

export { ProjectSchema } from './Project'
export { PostSchema } from './Posts'
export { SubtaskSchema } from './Subtask'
export { TaskSchema } from './Task'
export { TestSchema, TestFixture, TestFixture2 } from './Test'
