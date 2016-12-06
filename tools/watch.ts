'use strict'
import * as path from 'path'
import * as fs from 'fs'
import { Observable, Observer } from 'rxjs'
import { runTman } from './tman'

function watch (paths: string[]) {
  return Observable.from(paths)
    .map(p => path.join(process.cwd(), p))
    .mergeMap(path => {
      return Observable.create((observer: Observer<string>) => {
        fs.watch(path, { recursive: true }, evt => {
          observer.next(evt)
        })
        return () => fs.unwatchFile(path)
      })
    })
    .debounceTime(300)
}

watch(['spec-js'])
  .subscribe(() => {
    runTman()
  }, err => {
    console.error(err)
  })

process.on('uncaughtException', (err: any) => {
  console.log(`Caught exception: ${err.stack}`);
})

console.log('\x1b[1m\x1b[34mwatch start\x1b[39m\x1b[22m')
