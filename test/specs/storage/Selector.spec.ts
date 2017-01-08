import { Observable } from 'rxjs'
import * as lf from 'lovefield'
import { expect, use } from 'chai'
import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'
import { beforeEach, it, describe, afterEach } from 'tman'
import {
  Selector,
  lfFactory,
  TableShape,
  PredicateProvider,
  TOKEN_CONSUMED_ERR,
  TOKEN_INVALID_ERR
} from '../../index'

use(SinonChai)

interface Fixture {
  _id: string,
  time: number,
  name: string,
  folded?: boolean
}

export default describe('SelectMeta test', () => {
  let db: lf.Database
  let table: lf.schema.Table
  let version = 1

  let tableShape: TableShape
  let storeData: any[]

  beforeEach(function * () {
    const schemaBuilder = lf.schema.create('SelectMetaTest', version ++)
    const db$ = lfFactory(schemaBuilder, {
      storeType: lf.schema.DataStoreType.MEMORY,
      enableInspector: false
    })

    const tableBuilder = schemaBuilder.createTable('TestSelectMetadata')
    tableBuilder.addColumn('_id', lf.Type.STRING)
      .addColumn('name', lf.Type.STRING)
      .addColumn('time', lf.Type.NUMBER)
      .addPrimaryKey(['_id'])

    yield db$.do(r => {
      db = r
      table = db.getSchema().table('TestSelectMetadata')
    })

    const rows: lf.Row[] = []
    storeData = []
    for (let i = 0; i < 1000; i ++) {
      const row = {
        _id: `_id:${i}`,
        name: `name:${i}`,
        time: i
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
        }
      }
    }
  })

  afterEach(() => {
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
      new PredicateProvider(table, { time: { $gte: 50 } })
    )

    const results = yield selector.values()

    expect(results.length).to.equal(1000 - 50)
    results.forEach((ret: any) => {
      expect(ret.time >= 50).to.equals(true)
    })
  })

  it('reconsume should throw', function* () {
    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      new PredicateProvider(table, { time: { $gte: 50 } })
    )
    yield selector.values()

    try {
      yield selector.values()
    } catch (e) {
      expect(e.message).to.equal(TOKEN_CONSUMED_ERR().message)
    }
  })

  it('should get correct items when skip and limit', function* () {
    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      new PredicateProvider(table, { time: { $gt: 50 } }),
      20, 20
    )
    const result = yield selector.values()

    expect(result.length).to.equal(20)

    result.forEach((r: any) => {
      expect(r.time).to.greaterThan(70)
    })
  })

  it('should get sql string by toString method', () => {
    const selector = new Selector(db,
      db.select().from(table),
      tableShape,
      new PredicateProvider(table, { time: { $gt: 50 } }),
      20, 20
    )

    const sql = selector.toString()

    expect(sql).to.equal('SELECT * FROM TestSelectMetadata;')
  })

  describe('SelectMeta.prototype.changes', () => {
    it('observe should ok', done => {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gte: 50 } })
      )

      const newName = 'test name change'

      selector.changes()
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

    it('unsubscribe should ok', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gte: 50 } })
      )
      const stub = sinon.spy((): void => void 0)

      const newName = 'test name change'

      const subscription = selector.changes()
        .subscribe(stub)

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      subscription.unsubscribe()

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      expect(stub).to.be.calledOnce
    })

    it('reconsume should throw', () => {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gte: 50 } })
      )

      selector.changes()
      const get = () => selector.changes()

      expect(get).to.throw(TOKEN_CONSUMED_ERR().message)
    })

    it('should throw when getValue error', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gte: 50 } })
      )

      const changes = selector.changes()
        .publish()
        .refCount()

      const newName = 'test name change'

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:50'))
        .exec()

      const [result1] = yield changes.take(1)
      expect(result1.name).to.equal(newName)

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

    it('should observe changes when skip and limit', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gt: 50 } }),
        20, 20
      )

      const newName = 'new test name'

      const signal = selector.changes()
        .publish()
        .refCount()

      yield signal.take(1)

      yield db.update(table)
        .set(table['name'], newName)
        .where(table['_id'].eq('_id:71'))
        .exec()

      yield signal
        .take(1)
        .do((r: any) => {
          expect(r[0].name).to.equal(newName)
        })
    })

    it('should observe changes when prefetched data changed', function* () {
      const selector = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gt: 50 } }),
        20, 20
      )

      const signal = selector.changes()
        .publish()
        .refCount()

      yield signal.take(1)

      yield db.delete()
        .from(table)
        .where(lf.op.and(table['time'].gte(71), table['time'].lte(80)))
        .exec()

      yield signal.take(1)
        .do(r => {
          expect(r.length).to.equal(20)
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
        new PredicateProvider(table, { time: { $gt: 960 } }),
        20, 20
      )

      const signal = selector.changes()
        .publish()
        .refCount()

      yield signal.take(1)

      yield db.delete()
        .from(table)
        .where(lf.op.and(table['time'].gte(981), table['time'].lte(990)))
        .exec()

      yield signal.take(1)
        .do(r => {
          expect(r.length).to.equal(9)
          r.forEach((v: any) => {
            expect(v.time).to.gt(990)
            expect(v.time).to.lt(1000)
          })
        })
    })
  })

  describe('SelectMeta.prototype.combine', () => {
    let selector1: Selector<any>
    let selector2: Selector<any>
    let selector3: Selector<any>
    let selector4: Selector<any>
    let dist: Selector<any>

    beforeEach(() => {
      selector1 = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $lt: 50 } })
      )
      selector2 = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, {
          time: {
            $gte: 50,
            $lt: 100
          }
        })
      )

      const select1And2 = selector1.combine(selector2)

      selector3 = new Selector(db, db.select().from(table), tableShape, new PredicateProvider(table, {
        time: {
          $gte: 100,
          $lt: 150
        }
      }))

      selector4 = new Selector(db, db.select().from(table), tableShape, new PredicateProvider(table, {
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
          expect(r.length).to.equal(200)
          done()
        })
    })

    it('result should be combined', function* () {
      const result = yield dist.values()
      const count = 200
      expect(result.length).is.equals(count)
      result.forEach((r: any, index: number) => {
        expect(r).to.deep.equal(storeData[index])
      })
    })

    it('changes should observe all values from original SelectMeta', function* () {
      const changes$ = dist.changes()
        .publish()
        .refCount()

      changes$.subscribe()

      const update1 = 'test update name 1'
      const update2 = 'test update name 2'
      const update3 = 'test update name 3'

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
        new PredicateProvider(table, { time: { $gt: 50 } }),
        20, 20
      )
      const selector6 = new Selector(db,
        db.select().from(table),
        tableShape,
        new PredicateProvider(table, { time: { $gt: 100 } }),
        20, 20
      )

      const signal = selector5.combine(selector6)
        .changes()
        .publish()
        .refCount()

      yield signal.take(1)

      yield db.delete()
        .from(table)
        .where(table['time'].eq(81))
        .exec()

      yield signal.take(1)
        .do(r => {
          expect(r.length).to.equal(40)
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
          expect(r.length).to.equal(40)
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

    it('should throw when combine two different SelectMetas', () => {
      const different = new Selector(db, db.select(table['_id']).from(table), tableShape)
      const fn = () => dist.combine(different)
      expect(fn).to.throw(TOKEN_INVALID_ERR().message)
    })

  })

})
