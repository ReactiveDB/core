import 'rxjs'
import * as lf from 'lovefield'
import { expect, use } from 'chai'
import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'
import { beforeEach, it, describe, afterEach } from 'tman'
import { SelectMeta, lfFactory, TOKEN_CONSUMED_ERR, TOKEN_INVALID_ERR } from '../../index'

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

    for (let i = 0; i < 1000; i ++) {
      rows.push(table.createRow({
        _id: `_id:${i}`,
        name: 'name:${i}',
        time: i
      }))
    }

    yield db.insert().into(table).values(rows).exec()
  })

  afterEach(() => {
    db.close()
  })

  it('should create a instance successfully', () => {
    const selectMeta = new SelectMeta<Fixture>(db, db.select().from(table), (values: Fixture[]) => values)
    expect(selectMeta).to.be.instanceof(SelectMeta)
  })

  it('should getValues successfully via mapper', function* () {
    const selectMeta = new SelectMeta<Fixture>(db, db.select().from(table), (values: Fixture[]) => {
      return values.map(value => {
        value.folded = true
        return value
      })
    }, table['time'].gte(50))

    const results = yield selectMeta.values()

    expect(results.length).to.equal(1000 - 50)
    results.forEach((ret: any) => {
      expect((ret).folded).to.equals(true)
    })
  })

  it('should getValues successfully via table shape', function* () {
    const selectMeta = new SelectMeta<Fixture>(db, db.select().from(table), {
      primaryKey: {
        name: '_id',
        queried: true
      },
      definition: {
        _id: {
          column: '_id',
          id: true
        },
        name: {
          column: 'name'
        },
        time: {
          column: 'time'
        }
      }
    }, table['time'].gte(50))

    const results = yield selectMeta.values()

    expect(results.length).to.equal(1000 - 50)
    results.forEach((ret: any) => {
      expect(ret.time >= 50).to.equals(true)
    })
  })

  it('reconsume should throw', function* () {
    const meta = new SelectMeta(db, db.select().from(table), (rows: any[]) => {
      return rows.map(row => {
        row.folded = 'true'
        return row
      })
    }, table['time'].gte(50))
    yield meta.values()

    try {
      yield meta.values()
    } catch (e) {
      expect(e.message).to.equal(TOKEN_CONSUMED_ERR().message)
    }
  })

  describe('SelectMeta.prototype.changes', () => {
    it('observe should ok', done => {
      const selectMeta = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          value.folded = 'true'
          return value
        })
      }, table['time'].gte(50))

      const newName = 'test name change'

      selectMeta.changes()
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
      const selectMeta = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          value.folded = 'true'
          return value
        })
      }, table['time'].gte(50))
      const stub = sinon.spy((): void => void 0)

      const newName = 'test name change'

      const subscription = selectMeta.changes()
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

    it('reconsume should throw', function () {
      const selectMeta = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          return { ...value, folded: true }
        })
      }, table['time'].gte(50))

      selectMeta.changes()
      const get = () => selectMeta.changes()

      expect(get).to.throw(TOKEN_CONSUMED_ERR().message)
    })

    it('should throw when getValue error', function* () {
      const selectMeta = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          return { ...value, folded: true }
        })
      }, table['time'].gte(50))

      const changes = selectMeta.changes()
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

      selectMeta['getValue'] = () => Promise.reject(error)

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
  })

  describe('SelectMeta.prototype.combine', () => {
    let selectMeta1: SelectMeta<any>
    let selectMeta2: SelectMeta<any>
    let selectMeta3: SelectMeta<any>
    let selectMeta4: SelectMeta<any>
    let dist: SelectMeta<any>

    beforeEach(() => {
      selectMeta1 = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          return { ...value, folded: 1 }
        })
      }, table['time'].lt(50))
      selectMeta2 = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          return { ...value, folded: 2 }
        })
      }, lf.op.and(table['time'].gte(50), table['time'].lt(100)))

      const select1And2 = selectMeta1.combine(selectMeta2)

      selectMeta3 = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          return { ...value, folded: 3 }
        })
      }, lf.op.and(table['time'].gte(100), table['time'].lt(150)))

      selectMeta4 = new SelectMeta(db, db.select().from(table), (values: any[]) => {
        return values.map(value => {
          return { ...value, folded: 4 }
        })
      }, lf.op.and(table['time'].gte(150), table['time'].lt(200)))

      dist = select1And2.combine(selectMeta3, selectMeta4)
    })

    it('should return SelectMeta', () => {
      expect(dist).instanceof(SelectMeta)
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

      for (let i = 0; i < count; i++) {
        if (i < 50) {
          expect(result[i].folded).is.equals(1)
        } else if (i >= 50 && i < 100) {
          expect(result[i].folded).is.equals(2)
        } else if (i >= 100 && i < 150) {
          expect(result[i].folded).is.equals(3)
        } else {
          expect(result[i].folded).is.equals(4)
        }
      }
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

    it('should throw when combine two different SelectMetas', () => {
      const different = new SelectMeta(db, db.select(table['_id']).from(table), () => void 0)
      const fn = () => dist.combine(different)
      expect(fn).to.throw(TOKEN_INVALID_ERR().message)
    })

  })

})
