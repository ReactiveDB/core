import { Observable } from 'rxjs'
import { concatMap, tap } from 'rxjs/operators'

import { Database, RDBType, Relationship } from '../index'

export interface ProgramSchema {
  _id: string
  ownerId: string
  owner?: Object
  modules?: Object[]
}

export default (db: Database) => db.defineSchema<ProgramSchema>('Program', {
  _id: {
    type: RDBType.STRING,
    primaryKey: true
  },
  ownerId: {
    type: RDBType.STRING,
    index: true
  },
  owner: {
    type: Relationship.oneToOne,
    virtual: {
      name: 'Engineer',
      where: ref => ({
        ownerId: ref._id
      })
    }
  },
  modules: {
    type: Relationship.oneToMany,
    virtual: {
      name: 'Module',
      where: (
        moduleTable: lf.schema.Table
      ) => ({
        _id: moduleTable.parentId
      })
    }
  },
  ['@@dispose']: (rootEntities, scope) => {
    const [ matcher1, disposer1 ] = scope('Module')
    const [ matcher2, disposer2 ] = scope('Engineer')

    return matcher1({ parentId: { $in: rootEntities.map((e) => e._id) } }).pipe(
      tap(disposer1),
      concatMap(modules => {
        const engineers = rootEntities
          .map(entity => entity.ownerId)
          .concat(modules.map((m: any) => m.ownerId))
        return matcher2({ _id: { $in: engineers } })
      }),
      tap(disposer2),
    ) as Observable<any>
  }
})
