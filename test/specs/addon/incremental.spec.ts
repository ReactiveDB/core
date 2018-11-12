import { from, Observable, Observer } from 'rxjs'
import { last, concatMap } from 'rxjs/operators'
import { incremental } from '../../index'
import { describe, it } from 'tman'
import { expect, use } from 'chai'

import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'

use(SinonChai)

export default describe('Incremental Testcase: ', () => {
  it('should handle errors', function*() {
    try {
      yield from([[{ _id: 1 }], [3]]).pipe(
        incremental('_id'),
        last(),
      )
      throw Error('unreachable code path')
    } catch (err) {
      expect(err).is.ok
      expect(err.message).to.equal('cannot find pk: _id at curr.0')
    }
  })

  it('should handle next', function*() {
    const fixture = [{ _id: 2 }]
    const value = yield from([[{ _id: 1 }], fixture]).pipe(
      incremental('_id'),
      last(),
    )

    expect(value[0]).to.equal(fixture[0])
  })

  it('should handle complete', (done) => {
    from([[{ _id: 1 }], [{ _id: 2 }]])
      .pipe(
        incremental('_id'),
        last(),
      )
      .subscribe({
        complete: () => {
          done()
        },
      })
  })

  it('should handle complete: 2', (done) => {
    from([[{ _id: 1 }]])
      .pipe(
        incremental('_id'),
        last(),
      )
      .subscribe({
        complete: () => {
          done()
        },
      })
  })

  it('should be able to unsub', (done) => {
    const spy = sinon.spy()

    const obs = Observable.create((observer: Observer<any>) => {
      observer.next(1)
      return () => spy()
    })

    const sub$ = from([[{ _id: 1 }], [{ _id: 2 }]])
      .pipe(
        incremental('_id'),
        concatMap(() => obs),
      )
      .subscribe()

    setTimeout(() => {
      sub$.unsubscribe()
      expect(spy).to.have.called
      done()
    }, 10)
  })

  it('should be able to use default pk value', function*() {
    const value = yield from([[{ _id: 1 }]]).pipe(
      incremental(),
      last(),
    )

    expect(value[0]._id).to.equal(1)
  })

  it('should be able to prevent out-of-order execution', function*() {
    const value = yield from([[{ _id: 1 }], [{ _id: 2 }], [{ _id: 3 }]]).pipe(
      incremental(),
      last(),
    )

    expect(value[0]._id).to.equal(3)
  })

  it('should be able to skip if dataset is exactly the same', (done) => {
    let count = 0
    let ret = {}
    const first = [{ _id: 1 }]

    from([first, [{ _id: 1 }], [{ _id: 1 }]])
      .pipe(incremental())
      .subscribe({
        next(v) {
          count++
          ret = v
        },
        complete() {
          expect(count).to.equal(1)
          expect(ret).to.equal(first)
          done()
        },
      })
  })

  it('should not skip if order of data is changed', (done) => {
    let count = 0
    let ret = {}
    const first = [{ _id: 1 }, { _id: 2 }, { _id: 3 }]
    const second = [{ _id: 2 }, { _id: 3 }, { _id: 1 }]

    from([first, second])
      .pipe(incremental())
      .subscribe({
        next(v) {
          count++
          ret = v
        },
        complete() {
          expect(count).to.equal(2)
          expect(ret).to.deep.equal(second)
          done()
        },
      })
  })

  it('should be able to enable feat: auto-throttle', (done) => {
    let count = 0
    let value: any = {}

    from([[{ _id: 1 }], [{ _id: 2 }], [{ _id: 3 }]])
      .pipe(incremental({ timing: 100 }))
      .subscribe({
        next([ret]) {
          count++
          value = ret
        },
        complete() {
          expect(count).to.equal(1)
          expect(value._id).to.equal(3)
          done()
        },
      })
  })
})
