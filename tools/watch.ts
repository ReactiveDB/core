import * as path from 'path'
import { Observable, Observer, from } from 'rxjs'
import { map, mergeMap, debounceTime } from 'rxjs/operators'
import { runTman } from './tman'

const fileWacher = require('node-watch')

function watch(paths: string[]) {
  return from(paths).pipe(
    map((p) => path.join(process.cwd(), p)),
    mergeMap((p) => {
      return Observable.create((observer: Observer<string>) => {
        fileWacher(p, { recursive: true }, (_: any, fileName: string) => {
          observer.next(fileName)
        })
      })
    }),
    debounceTime(500),
  )
}

watch(['spec-js']).subscribe(
  () => {
    runTman()
  },
  (err) => {
    console.error(err)
  },
)

process.on('uncaughtException', (err: any) => {
  console.info(`Caught exception: ${err.stack}`)
})

console.info('\x1b[1m\x1b[34mwatch start\x1b[39m\x1b[22m')
