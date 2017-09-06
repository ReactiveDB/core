import { Observable, Scheduler, Subscription } from 'rxjs'
import * as lf from 'lovefield'
import { expect, use } from 'chai'
import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'
import { beforeEach, it, describe, afterEach } from 'tman'
import {
  Selector,
  DataStoreType,
  lfFactory,
  ShapeMatcher,
  PredicateProvider,
  Predicate,
  TokenConcatFailed,
  Logger
} from '../../../index'

use(SinonChai)

interface Fixture {
  _id: string,
  time: number,
  name: string,
  folded?: boolean
}

export default describe('Selector test', () => {
  const dataLength = 1000
  let db: lf.Database
  let table: lf.schema.Table
  let tableDef: { TestSelectMetadata: { table: lf.schema.Table } }
  let version = 1

  let tableShape: ShapeMatcher
  let storeData: any[]
  let subscription: Subscription

  function predicateFactory(desc: Predicate<any>) {
    return new PredicateProvider(tableDef, 'TestSelectMetadata', desc)
  }

  beforeEach(function * () {
    const schemaBuilder = lf.schema.create('SelectorTest', version ++)
    const db$ = lfFactory(schemaBuilder, {
      storeType: DataStoreType.MEMORY,
      enableInspector: false
    })

    const tableBuilder = schemaBuilder.createTable('TestSelectMetadata')
    tableBuilder.addColumn('_id', lf.Type.STRING)
      .addColumn('name', lf.Type.STRING)
      .addColumn('time', lf.Type.NUMBER)
      .addColumn('priority', lf.Type.NUMBER)
      .addPrimaryKey(['_id'])

    db$.connect()

    yield db$.do(r => {
      db = r
      table = db.getSchema().table('TestSelectMetadata')
    })

    const rows: lf.Row[] = []
    storeData = []
    for (let i = 0; i < dataLength; i ++) {
      const priority = Math.ceil(i / 100)
      const row = {
        _id: `_id:${i}`,
        name: `name:${i}`,
        time: i,
        priority: priority < 0 ? -priority : priority
      }
      rows.push(table.createRow(row))
      storeData.push(row)
    }

    yield db.insert().into(table).values(rows).exec()

    tableShape = {
      mainTable: table,
      pk: {
        queried: true,
        name: '_id'
      },
      definition: {
        _id: {
          column: '_id',
          id: true
        },
        name: {
          column: 'name',
          id: false
        },
        time: {
          column: 'time',
          id: false
        },
        priority: {
          column: 'priority',
          id: false
        }
      }
    }

    tableDef = { TestSelectMetadata: { table } }
  })

  afterEach(() => {
    if (subscription) {
      subscription.unsubscribe()
    }
    db.close()
  })

  it('should create a instance successfully', () => {
    const selector = new Selector<Fixture>(db, db.select().from(table), tableShape)
    expect(selector).to.be.instanceof(Selector)
  })

  it('should able to convert selector to sql', () => {
    const selector = new Selector<Fixture>(db, db.select().from(table), tableShape)
    expect(selector.toString()).to.equal('SELECT * FROM TestSelectMetadata;')
  })

  it('should getValues successfully via table shape', function* () {
    const selector = new Selector<Fixture>(db,
      db.select().from(table),
      tableShape,
      predicateFactory({ time: { $gte: 50 } })
    )

    const results = yield selector.values()

    expect(results).to.have.lengthOf(1000 - 50)
    results.forEach((ret: any) => {
      expect(ret.time >= 50).to.equals(true)
    })
  })

  it('should get correct items when skip and limit', function* () {
    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      predicateFactory({ time: { $gt: 50 } }),
      20, 20
    )
    const result = yield selector.values()

    expect(result).to.have.lengthOf(20)

    result.forEach((r: any) => {
      expect(r.time).to.greaterThan(70)
    })
  })

  it('should get sql string by toString method', () => {
    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      predicateFactory({ time: { $gt: 50 } }),
      20, 20
    )

    const sql = selector.toString()

    expect(sql).to.equal('SELECT * FROM TestSelectMetadata WHERE (TestSelectMetadata.time > 50);')
  })

  it('should get correct results with orderBy', function* () {
    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      predicateFactory({ time: { $gte: 50 } }),
      null, null,
      [
        { column: table['priority'], orderBy: lf.Order.ASC },
        { column: table['time'], orderBy: lf.Order.DESC },
      ]
    )

    yield selector.values()
      .do(result => {
        expect(result).to.have.lengthOf(950)
        const expectResult = storeData.filter(r => r.time >= 50)
          .sort((a, b) => {
            const higherPriority = Math.sign(a.priority - b.priority)
            const earlier = -Math.sign(a.time - b.time)
            return higherPriority * 10 + earlier
          })

        expect(result).to.deep.equal(expectResult)
      })
  })

  it('should ignore predicate when build predicate failed and give a warning', function* () {
    const err = new TypeError('not happy')

    const spy = sinon.spy(Logger, 'warn')

    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      predicateFactory({ get time() { throw err } }),
    )

    const results = yield selector.values()

    expect(results.length).to.equal(dataLength)
    expect(spy.callCount).to.equal(1)

    spy.restore()
  })

  describe('Selector.prototype.changes', () => {
    it('observe should ok', done => {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } })
      )

      const newName = 'test name change'

      subscription = selector.changes()
        .skip(1)
        .subscribe((r: any[]) => {
          expect(r[0].name).to.equal(newName)
          done()
        })

      db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()
    })

    it('should observe deletion of the only row in db', function* () {
      db.delete().from(table).exec() // 清空 table

      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({}),
      )

      const row = { _id: '_id:939.5', name: 'name:939.5', time: 939.5, priority: 10 }

      yield db.insert()
        .into(table)
        .values([table.createRow(row)])
        .exec()

      const signal = selector.changes()
      subscription = signal.subscribe()
      yield db.delete()
        .from(table)
        .where(table['_id'].eq('_id:939.5'))
        .exec()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do((r: any) => {
          expect(r).to.deep.equal([])
        })
    })

    it('unsubscribe should ok', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } })
      )
      const spy = sinon.spy((): void => void 0)

      const newName = 'test name change'

      const _subscription = selector.changes()
        .subscribe(spy)

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      _subscription.unsubscribe()

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      expect(spy.callCount).to.equal(1)
    })

    it('predicate should be clone before use', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } })
      )

      const newName = 'test name change'

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do(([ result ]) => {
          expect(result['name']).to.equal(newName)
        })

      yield db.update(table)
        .set(table['name'], newName + newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do(([ result ]) => {
          expect(result['name']).to.equal(newName + newName)
        })

    })

    it('should throw when getValue error', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } })
      )

      const changes = selector.changes()

      const newName = 'test name change'

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      yield changes.take(1)
        .do(([ result1 ]) => {
          expect(result1['name']).to.equal(newName)
        })

      const error = new TypeError('not happy')

      selector['getValue'] = () => Promise.reject(error)

      yield db.update(table)
        .set(table['name'], newName + newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      try {
        yield changes.take(1)
      } catch (e) {
        expect(e.message).to.equal(error.message)
      }
    })

    it('should work correctly with empty result set', function* () {
      const impossibleTime = -1
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $eq: impossibleTime } }),
        1, 0 // 添加 limit, skip 以模仿实际使用场景
      )

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do((r: any) => {
          // 确定能推出空结果集
          expect(r).to.deep.equal([])
        })

      const impossibleRow = {
        _id: '_id:939.5',
        name: 'name:939.5',
        time: impossibleTime,
        priority: 10
      }

      yield db.insert()
        .into(table)
        .values([table.createRow(impossibleRow)])
        .exec()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do((r: any) => {
          // 确定在空结果集上也能推出更新
          expect(r[0]).to.deep.equal(impossibleRow)
        })
    })

    it('should observe changes when skip and limit', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20
      )

      const newName = 'new test name'

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:71'))
        .exec()

      yield signal
        .take(1)
        .subscribeOn(Scheduler.async)
        .do((r: any) => {
          expect(r[0].name).to.equal(newName)
        })
    })

    it('should observe changes with skip and limit and sortBy', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20,
        [
          { column: table['priority'], orderBy: lf.Order.DESC },
          { column: table['time'], orderBy: lf.Order.ASC }
        ]
      )

      const newName = 'new test name'

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:921'))
        .exec()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do((r: any) => {
          expect(r[0].name).to.equal(newName)
        })

      const row = { _id: '_id:939.5', name: 'name:939.5', time: 939.5, priority: 10 }

      yield db.insert()
        .into(table)
        .values([table.createRow(row)])
        .exec()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do((r: any) => {
          expect(r[r.length - 1]).to.deep.equal(row)
        })

      yield db.delete()
        .from(table)
        .where(table['_id'].eq('_id:930'))
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do((r: any) => {
          expect(r[r.length - 1]._id).to.equal('_id:940')
        })
    })

    it('predicate should be clone before use when skip and limit', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20
      )

      const newName = 'new test name'

      const signal = selector.changes()

      yield signal.take(1)

      subscription = signal.subscribe()

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:71'))
        .exec()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do(([ r ]) => {
          expect(r['name']).to.equal(newName)
        })

      yield db.update(table)
        .set(table['name'], newName + newName)
        .where(table['_id'].eq('_id:71'))
        .exec()

      yield signal
        .subscribeOn(Scheduler.async)
        .take(1)
        .do(([ r ]) => {
          expect(r['name']).to.equal(newName + newName)
        })
    })

    it('should observe changes when prefetched data changed', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20
      )

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      yield db.delete()
        .from(table)
        .where(lf.op.and(table['time'].gte(71), table['time'].lte(80)))
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do(r => {
          expect(r).to.have.lengthOf(20)
          r.forEach((v: any) => {
            expect(v.time).to.gt(80)
            expect(v.time).to.lte(100)
          })
        })
    })

    it('should observe changes when last page data changed', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 960 } }),
        20, 20
      )

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      yield db.delete()
        .from(table)
        .where(lf.op.and(table['time'].gte(981), table['time'].lte(990)))
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do(r => {
          expect(r).to.have.lengthOf(9)
          r.forEach((v: any) => {
            expect(v.time).to.gt(990)
            expect(v.time).to.lt(1000)
          })
        })
    })

    it('should observe updates to an inserted row', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $lt: 0 } }),
        20
      )

      const signal = selector.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      const newRow = { _id: '_id:929.5', name: 'name:929.5', time: -1, priority: 10 }
      const row = table.createRow(newRow)

      yield db.insert()
        .into(table)
        .values([row])
        .exec()

      const newName = newRow.name + 'updated'
      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq(newRow._id))
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do(r => {
          expect(r).to.have.lengthOf(1)
          const diff = r.filter((d: Fixture) => d._id === newRow._id)
          expect(diff).to.have.lengthOf(1)
          if (diff.length === 1) {
            const diffRow: any = diff[0]
            expect(diffRow._id).to.equal(newRow._id)
            expect(diffRow.name).to.equal(newName)
          }
        })
    })

    it('query without prefetch should only emit one values when init', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } })
      )

      const spy = sinon.spy()

      const signal = selector.changes()

      subscription = signal.subscribe(spy)

      yield signal.take(1)

      expect(spy.callCount).to.equal(1)
    })

    it('query without prefetch and results is empty Array should only emit one values when init', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 10000 } })
      )

      const spy = sinon.spy()

      const signal = selector.changes()

      subscription = signal.subscribe(spy)

      yield signal.take(1)

      expect(spy.callCount).to.equal(1)
    })

    it('prefetch query should only emit one values when init', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20
      )

      const spy = sinon.spy()

      const signal = selector.changes()

      subscription = signal.subscribe(spy)

      yield signal.take(1)

      expect(spy.callCount).to.equal(1)
    })
  })

  describe('Selector.prototype.combine', () => {
    let selector1: Selector<any>
    let selector2: Selector<any>
    let selector3: Selector<any>
    let selector4: Selector<any>
    let dist: Selector<any>

    beforeEach(() => {
      selector1 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $lt: 50 } })
      )
      selector2 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({
          time: {
            $gte: 50,
            $lt: 100
          }
        })
      )

      const select1And2 = selector1.combine(selector2)

      selector3 = new Selector(db, db.select().from(table), tableShape, predicateFactory({
        time: {
          $gte: 100,
          $lt: 150
        }
      }))

      selector4 = new Selector(db, db.select().from(table), tableShape, predicateFactory({
        time: {
          $gte: 150,
          $lt: 200
        }
      }))

      dist = select1And2.combine(selector3, selector4)
    })

    it('should return SelectMeta', () => {
      expect(dist).instanceof(Selector)
    })

    it('result metadata should combine all results', done => {
      dist.values()
        .subscribe(r => {
          expect(r).to.have.lengthOf(200)
          done()
        })
    })

    it('result should be combined', function* () {
      const result = yield dist.values()
      const count = 200
      expect(result).to.have.lengthOf(count)
      result.forEach((r: any, index: number) => {
        expect(r).to.deep.equal(storeData[index])
      })
    })

    it('changes should observe all values from original SelectMeta', function* () {
      const changes$ = dist.changes()
        .subscribeOn(Scheduler.async, 1)
        .publish()
        .refCount()

      changes$.subscribe()

      const update1 = 'test update name 1'
      const update2 = 'test update name 2'
      const update3 = 'test update name 3'

      yield changes$.take(1)

      yield db.update(table)
        .set(table['name'], update1)
        .where(table['_id'].eq('_id:15'))
        .exec()

      yield changes$.take(1)
        .do(r => expect(r[15].name).equal(update1))

      yield db.update(table)
        .set(table['name'], update2)
        .where(table['_id'].eq('_id:55'))
        .exec()

      yield changes$.take(1)
        .do(r => expect(r[55].name).equal(update2))

      yield db.update(table)
        .set(table['name'], update3)
        .where(table['_id'].eq('_id:125'))
        .exec()

      yield changes$.take(1)
        .do(r => expect(r[125].name).equal(update3))
    })

    it('changes should observe all values with limit and skip', function* () {
      const selector5 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20
      )
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 100 } }),
        20, 20
      )

      const signal = selector5.combine(selector6)
        .changes()
        .subscribeOn(Scheduler.async, 1)
        .publish()
        .refCount()

      subscription = signal.subscribe()

      yield signal.take(1)

      yield db.delete()
        .from(table)
        .where(table['time'].eq(81))
        .exec()

      yield signal.take(1)
        .do(r => {
          expect(r).to.have.lengthOf(40)
          r.forEach(v => expect(v['time']).not.equal(81))
          Observable.from(r)
            .skip(19)
            .take(1)
            .subscribe(v => expect(v['time']).to.equal(91))
        })

      yield db.delete()
        .from(table)
        .where(table['time'].eq(135))
        .exec()

      yield signal.take(1)
        .do(r => {
          expect(r).to.have.lengthOf(40)
          r.forEach(v => expect(v['time']).not.equal(135))
          Observable.from(r)
            .last()
            .subscribe(v => expect(v['time']).to.equal(141))
        })

      const newName = 'xxx'

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['time'].eq(82))
        .exec()

      yield signal.take(1)
        .do(r => {
          r.filter(v => v['time'] === 82)
            .forEach(v => expect(v['name']).to.equal(newName))
        })

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['time'].eq(136))
        .exec()

      yield signal.take(1)
        .do(r => {
          r.filter(v => v['time'] === 136)
            .forEach(v => expect(v['name']).to.equal(newName))
        })
    })

    it('combined Selector#toString should return query String', () => {
      const _selector1 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } })
      )

      const _selector2 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $lte: 250 } })
      )

      const selector = _selector1.combine(_selector2)

      const sql = selector.toString()

      expect(sql).to.deep.equal(JSON.stringify([
        _selector1.toString(),
        _selector2.toString()
      ], null, 2))
    })
  })

  describe('Selector.prototype.concat', () => {
    let selector1: Selector<any>
    let selector2: Selector<any>
    let selector3: Selector<any>
    let selector4: Selector<any>
    let selector5: Selector<any>
    let dist: Selector<any>

    beforeEach(() => {
      selector1 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 0
      )
      selector2 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 20
      )

      selector3 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 40
      )

      selector4 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        10, 60
      )

      selector5 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 70
      )

      dist = selector1.concat(selector3, selector4, selector2, selector5)
    })

    it('should return SelectMeta', () => {
      expect(dist).instanceof(Selector)
    })

    it('result metadata should concat all results', done => {
      dist.values()
        .subscribe(r => {
          expect(r).to.have.lengthOf(90)
          done()
        })
    })

    it('result should be concated', function* () {
      const result = yield dist.values()
      const count = 90
      expect(result).to.have.lengthOf(count)
      result.forEach((r: any, index: number) => {
        expect(r).to.deep.equal(storeData[index + 50])
      })
    })

    it('changes should observe all values from original Selector', function* () {
      const changes$ = dist.changes()

      changes$.subscribe()

      const update1 = 'test update name 1'
      const update2 = 'test update name 2'
      const update3 = 'test update name 3'

      yield db.update(table)
        .set(table['name'], update1)
        .where(table['_id'].eq('_id:51'))
        .exec()

      yield changes$.take(1)
        .subscribeOn(Scheduler.async)
        .do(r => expect(r[1].name).equal(update1))

      yield db.update(table)
        .set(table['name'], update2)
        .where(table['_id'].eq('_id:55'))
        .exec()

      yield changes$.take(1)
        .subscribeOn(Scheduler.async)
        .do(r => expect(r[5].name).equal(update2))

      yield db.update(table)
        .set(table['name'], update3)
        .where(table['_id'].eq('_id:125'))
        .exec()

      yield changes$.take(1)
        .subscribeOn(Scheduler.async)
        .do(r => expect(r[75].name).equal(update3))
    })

    it('concat selector should ok when neither selectors have predicateProvider', function* () {
      selector1 = new Selector(db,
        db.select().from(table),
        tableShape,
        null,
        20, 0
      )
      selector2 = new Selector(db,
        db.select().from(table),
        tableShape,
        null,
        20, 20
      )
      const result = yield selector1.concat(selector2).values()
      expect(result).to.have.lengthOf(40)
      result.forEach((r: any, index: number) => {
        expect(r).to.deep.equal(storeData[index])
      })
    })

    it('concat selector should ok with OrderDescription', function* () {
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $lt: 930 } }),
        20, 0,
        [
          { column: table['priority'], orderBy: lf.Order.DESC },
          { column: table['time'], orderBy: lf.Order.DESC }
        ]
      )
      const selector7 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $lt: 930 } }),
        20, 20,
        [
          { column: table['priority'], orderBy: lf.Order.DESC },
          { column: table['time'], orderBy: lf.Order.DESC }
        ]
      )

      const dest = selector6.concat(selector7)

      const signal = dest.changes()

      subscription = signal.subscribe()

      yield signal.take(1)

      const newRow = { _id: '_id:929.5', name: 'name:929.5', time: 929.5, priority: 10 }

      const row = table.createRow(newRow)

      yield db.insert()
        .into(table)
        .values([row])
        .exec()

      yield signal.take(1)
        .subscribeOn(Scheduler.async)
        .do(([r]) => {
          expect(r).to.deep.equal(newRow)
        })

      yield db.delete()
        .from(table)
        .where(table['_id'].eq(newRow._id))
        .exec()
    })

    it('concat two selector limit not match should throw', () => {
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        10, 0
      )
      const selector7 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 11
      )

      const fn = () => selector6.concat(selector7)

      expect(fn).to.throw()
    })

    it('concat two selector predicate not match should throw', () => {
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 0
      )
      const selector7 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 20
      )

      const fn = () => selector6.concat(selector7)
      const error = TokenConcatFailed()

      expect(fn).to.throw(error.message)
    })

    it('concat two selector with one of the them not having a predicateProvider should throw with correct error message', () => {
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        null,
        20, 0
      )
      const selector7 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 20
      )

      const selector6_1 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 0
      )
      const selector7_1 = new Selector(db,
        db.select().from(table),
        tableShape,
        null,
        20, 20
      )

      const error = TokenConcatFailed()

      const fn = () => selector6.concat(selector7)
      expect(fn).to.throw(error.message)

      const fn_1 = () => selector6_1.concat(selector7_1)
      expect(fn_1).to.throw(error.message)
    })

    it('concat two selector select not match should throw', () => {
      const selector6 = new Selector(db,
        db.select(table['name']).from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 0
      )
      const selector7 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 20
      )

      const fn = () => selector6.concat(selector7)
      const error = TokenConcatFailed()

      expect(fn).to.throw(error.message)
    })

    it('concat two selector skip not serial should throw', () => {
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 0
      )
      const selector7 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gt: 50 } }),
        20, 40
      )

      const fn = () => selector6.concat(selector7)

      expect(fn).to.throw()
    })
  })

  describe('Selector.prototype.map', () => {
    let selector1: Selector<any>
    let selector2: Selector<any>
    let selector3: Selector<any>
    let selector4: Selector<any>
    let concated: Selector<any>
    let combined: Selector<any>
    const mapFn = (stream$: any) => stream$.map((v: any) => v.map(() => 1))
    const mapFn2 = (stream$: any) => stream$.map((v: any) => v.map(() => 2))
    const mapFn3 = (stream$: any) => stream$.map((v: any) => v.map(() => 3))

    mapFn.toString = () => 'TEST_MAP_FN'

    beforeEach(() => {
      selector1 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 0
      )
        .map(mapFn)
      selector2 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 20
      )
        .map(mapFn)

      concated = selector1.concat(selector2)

      selector3 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 40
      )
        .map(mapFn2)

      selector4 = new Selector(db,
        db.select().from(table),
        tableShape,
        predicateFactory({ time: { $gte: 50 } }),
        20, 60
      )
        .map(mapFn3)

      combined = selector3.combine(selector4)
    })

    it('should map all result from value', function* () {

      yield selector1.values()
        .do(data => {
          data.forEach(r => expect(r).to.equal(1))
        })
    })

    it('should map all result from changes', function* () {

      yield selector1.changes()
        .take(1)
        .do(data => {
          data.forEach(r => expect(r).to.equal(1))
        })
    })

    it('should map all result from concated selector#value', function* () {
      yield concated.values()
        .do(data => {
          data.forEach(r => expect(r).to.equal(1))
        })
    })

    it('should map all result from concated selector#change', function* () {
      yield concated.changes()
        .take(1)
        .do(data => {
          data.forEach(r => expect(r).to.equal(1))
        })
    })

    it('should map all result from combined selector#value', function* () {
      yield combined.values()
        .do(data => {
          data.splice(0, 20)
            .forEach(r => expect(r).to.equal(2))
        })
        .do(data => {
          data.splice(20)
            .forEach(r => expect(r).to.equal(3))
        })
    })

    it('should map all result from combined selector#changes', function* () {
      yield combined.changes()
        .take(1)
        .do(data => {
          data.splice(0, 20)
            .forEach(r => expect(r).to.equal(2))
        })
        .do(data => {
          data.splice(20)
            .forEach(r => expect(r).to.equal(3))
        })
    })
  })

})
