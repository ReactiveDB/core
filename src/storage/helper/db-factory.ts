import * as lf from 'lovefield'
import { Observable, ConnectableObservable, ReplaySubject, Observer } from 'rxjs'
import { publishReplay } from 'rxjs/operators'
import { LfFactoryInit } from '../../interface'

export const rawDb$ = new ReplaySubject<lf.raw.BackStore>(1)

function onUpgrade (rawDb: lf.raw.BackStore) {
  rawDb$.next(rawDb)
  rawDb$.complete()
  return Promise.resolve()
}

export const lfFactory = (schemaBuilder: lf.schema.Builder, config: LfFactoryInit): ConnectableObservable<lf.Database> => {
  return Observable.create((observer: Observer<lf.Database>) => {
    (config as any).onUpgrade = onUpgrade
    if (config.storeType >= 3) {
      config.storeType = config.storeType + 1
    }

    schemaBuilder.connect(config as any)
      .then(db => {
        observer.next(db)
        observer.complete()
      })
      .catch(e => observer.error(e))
  }).pipe(publishReplay(1))
}
