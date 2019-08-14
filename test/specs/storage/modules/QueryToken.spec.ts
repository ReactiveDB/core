import { describe, beforeEach, it } from 'tman'
import { expect } from 'chai'
import { of } from 'rxjs'
import { combineLatest, take, skip, publishReplay, refCount, tap, map, publish } from 'rxjs/operators'

import { MockSelector } from '../../../utils/mocks'
import { taskGen } from '../../../utils/generators'
import { QueryToken, TaskSchema, clone, TokenConsumed } from '../../../index'
import { Op } from '../../../../src/utils/diff'

export default describe('QueryToken Testcase', () => {
  const generateMockTestdata = (_tasks: TaskSchema[]) => {
    const testData = new Map<string, TaskSchema>()
    clone(_tasks).forEach((val) => {
      testData.set(val._id as string, val)
    })
    return testData
  }

  describe('Class QueryToken:', () => {
    let queryToken: QueryToken<TaskSchema>
    let mockSelector: MockSelector<TaskSchema>
    let tasks: TaskSchema[]

    beforeEach(() => {
      tasks = taskGen(25)
      mockSelector = new MockSelector(generateMockTestdata(tasks))
      queryToken = new QueryToken(of(mockSelector) as any)
    })

    it('should be instantiated successfully', () => {
      expect(queryToken).to.be.instanceof(QueryToken)
    })

    describe('Method: values', () => {
      it('should return values', (done) => {
        queryToken
          .values()
          .pipe(combineLatest(mockSelector.values()))
          .subscribe(([r1, r2]) => {
            expect(r1).to.deep.equal(r2)
            done()
          })
      })

      it('should be completed after values emited', function*() {
        yield queryToken.values()
      })

      it('should throw when reconsumed', function*() {
        yield queryToken.values()
        const fn = () => queryToken.values()
        expect(fn).to.throw(TokenConsumed().message)
      })
    })

    describe('Method: changes', () => {
      it('should get initial value', function*() {
        const value = yield queryToken.changes().pipe(take(1))
        expect(value).to.deep.equal(tasks)
      })

      it('should be notified when something updated', (done) => {
        const task = tasks[0]
        const newNote = 'test task note'

        queryToken
          .changes()
          .pipe(skip(1))
          .subscribe((r) => {
            expect(r[0].note).to.equal(newNote)
            done()
          })

        MockSelector.update(task._id as string, {
          note: newNote,
        })
      })

      it('should throw when reconsumed', function*() {
        yield queryToken.changes().pipe(take(1))

        const fn = () => queryToken.changes().pipe(take(1))

        expect(fn).to.throw(TokenConsumed().message)
      })
    })

    describe('Method: traces', () => {
      it('should get traces when updated', (done) => {
        const task = tasks[0]
        const newNote = 'new task note'

        queryToken
          .traces('_id')
          .pipe(skip(1))
          .subscribe((r) => {
            const { result, type, ops } = r
            expect(result[0].note).to.equal(newNote)
            expect(type).to.equal(1)
            ops.forEach((op: Op, index: number) => {
              if (index === 0) {
                expect(op.type).to.equal(1)
              } else {
                expect(op.type).to.equal(0)
              }
            })
            done()
          })

        MockSelector.update(task._id as string, {
          note: newNote,
        })
      })

      it('should emit result when the returning observable is re-subscribed', function*() {
        const data$ = queryToken.traces('_id')

        yield data$.pipe(take(1)).toPromise()

        let emittedOnResubscribe = false

        yield data$.pipe(take(1)).subscribe(() => (emittedOnResubscribe = true))

        expect(emittedOnResubscribe).to.be.true
      })
    })

    describe('Method: toString', () => {
      it('should be able to stringify', function*() {
        const sql = yield queryToken.toString()
        expect(sql).to.equal(mockSelector.toString())
      })
    })

    describe('Method: combine', () => {
      let tasks2: TaskSchema[]
      let mockSelector2: MockSelector<TaskSchema>
      let queryToken2: QueryToken<TaskSchema>
      let combined: QueryToken<TaskSchema>

      beforeEach(() => {
        tasks2 = taskGen(25)
        mockSelector2 = new MockSelector(generateMockTestdata(tasks2))
        queryToken2 = new QueryToken(of(mockSelector2) as any)
        combined = queryToken.combine(queryToken2)
        combined.selector$.subscribe((mock) => {
          expect(mock['__test_label_selector_kind__']).to.equal('by combine')
        })
      })

      it('should get a new QueryToken', () => {
        expect(combined).to.be.instanceof(QueryToken)
      })

      it('should return combined values', function*() {
        const result = yield combined.values()
        expect(result).to.deep.equal(tasks.concat(tasks2))
      })

      it('should be notified once origin Selector updated', function*() {
        const source$ = combined.changes().pipe(
          publishReplay(1),
          refCount(),
        )

        source$.subscribe()

        const newNote1 = 'test note 1'
        const newNote2 = 'test note 2'

        MockSelector.update(tasks[0]._id as string, {
          note: newNote1,
        })

        yield source$.pipe(
          take(1),
          tap((r) => {
            expect(r[0].note).to.equal(newNote1)
          }),
        )

        MockSelector.update(tasks2[0]._id as string, {
          note: newNote2,
        })

        yield source$.pipe(
          take(1),
          tap((r) => {
            expect(r[tasks.length].note).to.equal(newNote2)
          }),
        )
      })

      it('should throw when reconsumed values', function*() {
        yield combined.values()

        const fn1 = () => combined.values()

        expect(fn1).to.throw(TokenConsumed().message)
      })

      it('should throw when reconsumed changes', function*() {
        yield combined.changes().pipe(take(1))

        const fn1 = () => combined.changes()

        expect(fn1).to.throw(TokenConsumed().message)
      })
    })

    describe('Method: combine with traces', () => {
      let tasks2: TaskSchema[]
      let mockSelector2: MockSelector<TaskSchema>
      let queryToken2: QueryToken<TaskSchema>

      beforeEach(() => {
        tasks2 = taskGen(25)
        mockSelector2 = new MockSelector(generateMockTestdata(tasks2))
        queryToken2 = new QueryToken(of(mockSelector2) as any)
      })

      it('should use lastEmit values when combined', (done) => {
        queryToken.traces().subscribe()

        const combined = queryToken.combine(queryToken2)
        combined.traces().subscribe((r) => {
          expect(r.type).to.equal(1)
          r.ops.forEach((op: Op, index: number) => {
            if (index < 25) {
              expect(op.type).to.equal(0)
            } else {
              expect(op.type).to.equal(1)
            }
          })
          done()
        })
      })
    })

    describe('Method: combine with traces', () => {
      let tasks2: TaskSchema[]
      let mockSelector2: MockSelector<TaskSchema>
      let queryToken2: QueryToken<TaskSchema>

      beforeEach(() => {
        tasks2 = taskGen(25)
        mockSelector2 = new MockSelector(generateMockTestdata(tasks2))
        queryToken2 = new QueryToken(of(mockSelector2) as any)
      })

      it('should use lastEmit values when combined', (done) => {
        queryToken.traces().subscribe()

        const combined = queryToken.combine(queryToken2)
        combined.traces().subscribe((r) => {
          expect(r.type).to.equal(1)
          r.ops.forEach((op: Op, index: number) => {
            if (index < 25) {
              expect(op.type).to.equal(0)
            } else {
              expect(op.type).to.equal(1)
            }
          })
          done()
        })
      })
    })

    describe('Method: concat', () => {
      let tasks2: TaskSchema[]
      let mockSelector2: MockSelector<TaskSchema>
      let queryToken2: QueryToken<TaskSchema>
      let concated: QueryToken<TaskSchema>

      beforeEach(() => {
        tasks2 = taskGen(25)
        mockSelector2 = new MockSelector(generateMockTestdata(tasks2))
        queryToken2 = new QueryToken(of(mockSelector2) as any)
        concated = queryToken.concat(queryToken2)
        concated.selector$.subscribe((mock) => {
          expect(mock['__test_label_selector_kind__']).to.equal('by concat')
        })
      })

      it('should get new QueryToken', () => {
        expect(concated).to.be.instanceof(QueryToken)
      })

      it('should return concated values', function*() {
        const result = yield concated.values()
        expect(result).to.deep.equal(tasks.concat(tasks2))
      })

      it('should be notified once origin Selector updated', function*() {
        const source$ = concated.changes().pipe(
          publishReplay(1),
          refCount(),
        )

        source$.subscribe()

        const newNote1 = 'test note 1'
        const newNote2 = 'test note 2'

        MockSelector.update(tasks[0]._id as string, {
          note: newNote1,
        })

        yield source$.pipe(
          take(1),
          tap((r) => {
            expect(r[0].note).to.equal(newNote1)
          }),
        )

        MockSelector.update(tasks2[0]._id as string, {
          note: newNote2,
        })

        yield source$.pipe(
          take(1),
          tap((r) => {
            expect(r[tasks.length].note).to.equal(newNote2)
          }),
        )
      })

      it('should throw when reconsumed values', function*() {
        yield concated.values()

        const fn1 = () => concated.values()

        expect(fn1).to.throw(TokenConsumed().message)
      })

      it('should throw when reconsumed changes', function*() {
        yield concated.changes().pipe(take(1))

        const fn1 = () => concated.changes()

        expect(fn1).to.throw(TokenConsumed().message)
      })
    })

    describe('Method: concat with traces', () => {
      let tasks2: TaskSchema[]
      let mockSelector2: MockSelector<TaskSchema>
      let queryToken2: QueryToken<TaskSchema>

      beforeEach(() => {
        tasks2 = taskGen(25)
        mockSelector2 = new MockSelector(generateMockTestdata(tasks2))
        queryToken2 = new QueryToken(of(mockSelector2) as any)
      })

      it('should use lastEmit values when concated', (done) => {
        queryToken.traces().subscribe()
        const concated = queryToken.concat(queryToken2)
        concated.traces().subscribe((r) => {
          expect(r.type).to.equal(1)
          r.ops.forEach((op: Op, index: number) => {
            if (index < 25) {
              expect(op.type).to.equal(0)
            } else {
              expect(op.type).to.equal(1)
            }
          })
          done()
        })
      })
    })

    describe('Method: map', () => {
      it('should replace the returnValue of `values`', function*() {
        const q1 = queryToken.map((v) => v.pipe(map((r) => r.map(() => 1))))

        yield q1.values().pipe(
          tap((r) => {
            r.forEach((v) => expect(v).to.equal(1))
          }),
        )
      })

      it('should replace the returnValue of `changes`', function*() {
        const q2 = queryToken.map((v) => v.pipe(map((r) => r.map(() => 2))))

        const signal = q2.changes().pipe(
          publish(),
          refCount(),
        )

        yield signal.pipe(
          take(1),
          tap((r: any[]) => {
            r.forEach((v) => expect(v).to.equal(2))
          }),
        )

        MockSelector.update(tasks[0]._id as string, {
          note: 'new note',
        })

        yield signal.pipe(
          take(1),
          tap((r: any[]) => {
            r.forEach((v) => expect(v).to.equal(2))
          }),
        )
      })

      it("should replace returnValue of the combined token's `values`", function*() {
        const tasks1 = taskGen(25)
        const mockSelector1 = new MockSelector(generateMockTestdata(tasks1))
        const queryToken1 = new QueryToken(of(mockSelector1) as any)

        const q3 = queryToken1.map((v) => v.pipe(map((r) => r.map(() => 3))))

        const distToken = q3.combine(queryToken1)
        yield distToken.values().pipe(
          tap((r) => {
            r.splice(25, 50).forEach((v) => expect(v).to.equal(3))
          }),
        )
      })

      it("should replace returnValue of the combined token's `changes`", function*() {
        const tasks1 = taskGen(25)
        const mockSelector1 = new MockSelector(generateMockTestdata(tasks1))
        const queryToken1 = new QueryToken(of(mockSelector1) as any)

        const q4 = queryToken1.map((v) => v.pipe(map((r) => r.map(() => 4))))

        const distToken = q4.combine(queryToken1)
        const signal = distToken.changes().pipe(
          publish(),
          refCount(),
        )

        yield signal.pipe(
          take(1),
          tap((r: any[]) => {
            r.splice(25, 50).forEach((v) => expect(v).to.equal(4))
          }),
        )

        MockSelector.update(tasks1[0]._id as string, {
          note: 'new note',
        })

        yield signal.pipe(
          take(1),
          tap((r: any[]) => {
            r.splice(25, 50).forEach((v) => expect(v).to.equal(4))
          }),
        )
      })
    })
  })
})
