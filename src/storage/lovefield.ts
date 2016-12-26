'use strict'
import * as lf from 'lovefield'
import { Observable } from 'rxjs/Observable'
import { ReplaySubject } from 'rxjs/ReplaySubject'
import { Observer } from 'rxjs/Observer'

export interface LfFactoryInit {
  storeType: lf.schema.DataStoreType
  enableInspector: boolean
}

export const rawDb$ = new ReplaySubject<lf.raw.BackStore>(1)

function onUpgrade (rawDb: lf.raw.BackStore) {
  rawDb$.next(rawDb)
  rawDb$.complete()
  return Promise.resolve()
}

export const lfFactory = (schemaBuilder: lf.schema.Builder, config: LfFactoryInit): Observable<lf.Database> => {
  return Observable.create((observer: Observer<lf.Database>) => {
    (config as any).onUpgrade = onUpgrade
    schemaBuilder.connect(config)
      .then(db => {
        observer.next(db)
        observer.complete()
      })
      .catch(e => observer.error(e))
  })
    .publishReplay(1)
    .refCount()
}
