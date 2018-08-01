import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'

import { Database, RDBType, Relationship } from '../index'

export interface ModuleSchema {
  _id: string
  name: string
  ownerId: string
  programmer?: Object
  parentId: string
}

export default (db: Database) => db.defineSchema<ModuleSchema>('Module', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  name: {
    type: RDBType.STRING,
    unique: true
  },
  ownerId: {
    type: RDBType.STRING
  },
  parentId: {
    type: RDBType.STRING
  },
  programmer: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Engineer',
      where: ref => ({
        ownerId: ref._id
      })
    }
  },
  dispose(rootEntities, scope) {
    const [ matcher, disposer ] = scope('Engineer')
    return matcher({ _id: { $in: rootEntities.map(entity => entity.ownerId) } }).pipe(tap(disposer)) as Observable<any>
  }
})
