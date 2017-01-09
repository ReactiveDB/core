import { describe, beforeEach, it } from 'tman'
import { expect } from 'chai'
import { Observable } from 'rxjs/Observable'
import MockSelectMeta from '../../utils/MockSelectMeta'
import taskGenerator from '../../utils/taskGenerator'
import { QueryToken, TaskSchema, clone } from '../../index'

export default describe('QueryToken test', () => {
  let queryToken: QueryToken<TaskSchema>
  let mockSelectMeta: MockSelectMeta<TaskSchema>
  let tasks: TaskSchema[]

  const generateMockTestdata = (_tasks: TaskSchema[]) => {
    const testData = new Map<string, TaskSchema>()
    clone(_tasks).forEach(val => {
      testData.set(val._id as string, val)
    })
    return testData
  }

  beforeEach(() => {
    tasks = taskGenerator(25)
    mockSelectMeta = new MockSelectMeta(generateMockTestdata(tasks))
    queryToken = new QueryToken(Observable.of(mockSelectMeta) as any)
  })

  describe('constructor', () => {
    it('should return instance of QueryToken', () => {
      expect(queryToken).to.be.instanceof(QueryToken)
    })
  })

  describe('QueryToken.prototype.values', () => {
    it('should return Observable of selectMeta values', done => {
      queryToken.values()
        .combineLatest(mockSelectMeta.values())
        .subscribe(([r1, r2]) => {
          expect(r1).to.deep.equal(r2)
          done()
        })
    })

    it('should complete after values emited', function* () {
      yield queryToken.values()
    })
  })

  describe('QueryToken.prototype.changes', () => {
    it('should get initial value', function* () {
      const value = yield queryToken.changes().take(1)
      expect(value).to.deep.equal(tasks)
    })

    it('should be notified when something updated', done => {
      const task = tasks[0]
      const newNote = 'test task note'

      queryToken.changes()
        .skip(1)
        .subscribe(r => {
          expect(r[0].note).to.equal(newNote)
          done()
        })

      MockSelectMeta.update(task._id as string, {
        note: newNote
      })
    })
  })

  it('QueryToken.prototype.toString', function* () {
    const sql = yield queryToken.toString()
    expect(sql).to.equal(mockSelectMeta.toString())
  })

  describe('QueryToken.prototype.combine', () => {
    let tasks2: TaskSchema[]
    let mockSelectMeta2: MockSelectMeta<TaskSchema>
    let queryToken2: QueryToken<TaskSchema>
    let combined: QueryToken<TaskSchema>

    beforeEach(() => {
      tasks2 = taskGenerator(25)
      mockSelectMeta2 = new MockSelectMeta(generateMockTestdata(tasks2))
      queryToken2 = new QueryToken(Observable.of(mockSelectMeta2) as any)
      combined = queryToken.combine(queryToken2)
    })

    it('should return new QueryToken', () => {
      expect(combined).to.be.instanceof(QueryToken)
    })

    it('combined.values should return combined values', function* () {
      const result = yield combined.values()
      expect(result).to.deep.equal(tasks.concat(tasks2))
    })

    it('should notified when origin SelectMeta updated', function* () {
      const source$ = combined.changes()
        .publishReplay(1)
        .refCount()

      source$.subscribe()

      const newNote1 = 'test note 1'
      const newNote2 = 'test note 2'

      MockSelectMeta.update(tasks[0]._id as string, {
        note: newNote1
      })

      yield source$.take(1)
        .do(r => {
          expect(r[0].note).to.equal(newNote1)
        })

      MockSelectMeta.update(tasks2[0]._id as string, {
        note: newNote2
      })

      yield source$.take(1)
        .do(r => {
          expect(r[tasks.length].note).to.equal(newNote2)
        })
    })
  })
})
