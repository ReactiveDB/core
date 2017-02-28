import * as path from 'path'
import { Observable, Observer } from 'rxjs'
import { runTman } from './tman'

const fileWacher = require('node-watch')

function watch (paths: string[]) {
  return Observable.from(paths)
    .map(p => path.join(process.cwd(), p))
    .mergeMap(path => {
      return Observable.create((observer: Observer<string>) => {
        fileWacher(path, (evt: any) => {
          observer.next(evt)
        })
        return () => fileWacher.close()
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
