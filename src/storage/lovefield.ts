'use strict'
import 'rxjs/add/observable/fromPromise'
import 'rxjs/add/operator/publishReplay'
import 'rxjs/add/operator/do'
import * as lf from 'lovefield'
import { Observable } from 'rxjs/Observable'
import { Observer } from 'rxjs/Observer'

export const schemaBuilder = lf.schema.create('teambition', 1)

export const database$: Observable<lf.Database> = Observable.create((observer: Observer<lf.Database>) => {
  schemaBuilder.connect({storeType: lf.schema.DataStoreType.MEMORY})
    .then(db => {
      observer.next(db)
      observer.complete()
    })
    .catch(e => observer.error(e))
})
  .publishReplay(1)
  .refCount()
