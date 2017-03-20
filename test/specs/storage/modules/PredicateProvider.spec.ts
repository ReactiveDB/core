import * as lf from 'lovefield'
import { describe, it, beforeEach } from 'tman'
import { expect } from 'chai'
import { PredicateProvider, lfFactory, DataStoreType } from '../../../index'

export default describe('PredicateProvider test', () => {
  const dataLength = 1000
  let db: lf.Database
  let table: lf.schema.Table
  let version = 1

  beforeEach(function* () {
    const schemaBuilder = lf.schema.create('PredicateProviderDatabase', version++)
    const db$ = lfFactory(schemaBuilder, {
      storeType: DataStoreType.MEMORY,
      enableInspector: false
    })
    const tableBuilder = schemaBuilder.createTable('TestPredicateProvider')
    tableBuilder.addColumn('_id', lf.Type.STRING)
      .addColumn('name', lf.Type.STRING)
      .addColumn('time1', lf.Type.NUMBER)
      .addColumn('time2', lf.Type.NUMBER)
      .addColumn('times', lf.Type.STRING)
      .addColumn('nullable', lf.Type.BOOLEAN)
      .addPrimaryKey(['_id'])
      .addNullable(['nullable'])

    db$.connect()
    db = yield db$.do(r => {
      table = r.getSchema().table('TestPredicateProvider')
    })
    const rows: lf.Row[] = []
    for (let i = 0; i < dataLength; i ++) {
      rows.push(table.createRow({
        _id: `_id:${i}`,
        name: `name:${i}`,
        time1: i,
        time2: dataLength - i,
        times: [i - 1, i , i + 1].map(r => `times: ${r}`).join('|') ,
        nullable: i >= 300 ? null : false
      }))
    }
    yield db.insert().into(table).values(rows).exec()
  })

  describe('PredicateProvider#getPredicate', () => {
    it('invalid key should be ignored', function*() {
      const fn = () => new PredicateProvider(table, {
        nonExist: 'whatever'
      }).getPredicate()

      const expectResult = yield db.select().from(table).exec()
      const result = yield db.select().from(table).where(fn()).exec()
      expect(result).deep.equal(expectResult)
    })

    it('literal value should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: 20
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(1)
      expect(result[0]['time1']).to.equal(20)
    })

    it('$ne should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $ne: 20
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(dataLength - 1)

      result.forEach((r: any) => expect(r['time1'] === 20).to.be.false)
    })

    it('$lt should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $lt: 20
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(20)
      result.forEach((r: any) => expect(r['time1'] < 20).to.be.true)
    })

    it('$lte should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $lte: 19
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(20)
      result.forEach((r: any) => expect(r['time1'] <= 19).to.be.true)
    })

    it('$gt should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time2: {
          $gt: 20
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(dataLength - 20)
      result.forEach((r: any) => expect(r['time2'] > 20).to.be.true)
    })

    it('$gte should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time2: {
          $gte: 21
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(dataLength - 20)
      result.forEach((r: any) => expect(r['time2'] >= 21).to.be.true)
    })

    it('$match should ok', function* () {
      const regExp = /\:(\d{0,1}1$)/
      const predicate = new PredicateProvider(table, {
        name: {
          $match: regExp
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(10)
      result.forEach((r: any) => expect(regExp.test(r['name'])).to.be.true)
    })

    it('$notMatch should ok', function* () {
      const regExp = /\:(\d{0,1}1$)/
      const predicate = new PredicateProvider(table, {
        name: {
          $notMatch: regExp
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      // 上一个测试中结果长度是 10
      expect(result).to.have.lengthOf(dataLength - 10)
      result.forEach((r: any) => expect(regExp.test(r['name'])).to.be.false)
    })

    it('$between should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $between: [1, 20]
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(20)
      result.forEach((r: any) => expect(r['time1'] > 0 && r['time1'] <= 20).to.be.true)
    })

    it('$has should ok', function* () {
      const predicate = new PredicateProvider(table, {
        times: {
          $has: 'times: 10'
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(3)
      result.forEach((r: any) => {
        expect(r.times.match(/times: 10\b/)).to.not.be.null
      })
    })

    it('$in should ok', function* () {
      const seed = [10, 20, 30, 10000]
      const predicate = new PredicateProvider(table, {
        time1: {
          $in: seed
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(3)
      result.forEach((r: any) => expect(seed.indexOf(r['time1']) !== -1).to.be.true)
    })

    it('$isNull should ok', function* () {
      const predicate = new PredicateProvider(table, {
        nullable: {
          $isNull: true
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(700)
      result.forEach((r: any) => expect(r['nullable']).to.be.null)
    })

    it('$isNotNull should ok', function* () {
      const predicate = new PredicateProvider(table, {
        nullable: {
          $isNotNull: true
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(300)
      result.forEach((r: any) => expect(r['nullable']).to.not.be.null)
    })

    it('$not should ok', function* () {
      const predicate = new PredicateProvider(table, {
        $not: {
          time1: 0
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(dataLength - 1)
    })

    it('$and should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $and: {
            $lt: 200,
            $gte: 50
          }
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(150)
      result.forEach((r: any) => expect(r['time1'] >= 50 && r['time1'] < 200).to.be.true)
    })

    it('$or should ok', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $or: {
            $gte: dataLength - 50,
            $lt: 50
          }
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(100)
      result.forEach((r: any) => expect(r['time1'] >= dataLength - 50 || r['time1'] < 50).to.be.true)
    })

    it('compoundPredicate should skip null/undefined property', function* () {
      const predicate = new PredicateProvider(table, {
        time1: {
          $or: {
            $gte: dataLength - 50,
            $lt: null,
          }
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(50)
      result.forEach((r: any) => expect(r['time1'] >= dataLength - 50).to.be.true)
    })

    it('complex PredicateDescription should ok', function* () {
      const reg = /\:(\d{0,1}1$)/
      const predicate = new PredicateProvider(table, {
        time1: {
          $or: {
            $gte: dataLength - 50,
            $lt: 50
          }
        },
        time2: {
          $and: {
            $gte: dataLength / 2,
            $lt: dataLength
          }
        },
        name: {
          $match: reg
        }
      }).getPredicate()

      const result = yield db.select()
        .from(table)
        .where(predicate)
        .exec()

      expect(result).to.have.lengthOf(5)

      result.forEach((r: any) => {
        const pred1 = r['time1'] >= dataLength - 50 || r['time1'] < 50
        const pred2 = r['time2'] >= dataLength / 2 && r['time2'] < dataLength
        const pred3 = reg.test(r['name'])

        expect(pred1 && pred2 && pred3).to.be.true
      })
    })
  })
})
