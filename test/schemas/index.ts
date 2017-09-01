import { Database } from '../index'

import ProjectSelectMetadata from './Project'
import SubtaskSelectMetadata from './Subtask'
import TaskSelectMetadata from './Task'
import TasklistSelectMetadata from './Tasklist'
import PostSelectMetadata from './Post'
import OrganizationSelectMetadata from './Organization'
import EngineerSelectMetadata from './Engineer'
import ModuleSelectMetadata from './Module'
import ProgramSelectMetadata from './Program'

export default (db: Database) => {
  ProjectSelectMetadata(db)
  SubtaskSelectMetadata(db)
  TaskSelectMetadata(db)
  PostSelectMetadata(db)
  EngineerSelectMetadata(db)
  ModuleSelectMetadata(db)
  ProgramSelectMetadata(db)
  OrganizationSelectMetadata(db)
  TasklistSelectMetadata(db)
}

export { ProjectSchema } from './Project'
export { PostSchema } from './Post'
export { OrganizationSchema } from './Organization'
export { SubtaskSchema } from './Subtask'
export { TaskSchema } from './Task'
export { TasklistSchema } from './Tasklist'
export { ProgramSchema } from './Program'
export { ModuleSchema } from './Module'
export { EngineerSchema } from './Engineer'
export { TestSchema, TestFixture, TestFixture2 } from './Test'

/**
 * import ActivitySelectMeta from './Activity'
 * ActivitySelectMeta(db)
 * export { ActivitySchema } from './Activity'
 */
