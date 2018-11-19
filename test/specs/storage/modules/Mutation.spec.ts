import { beforeEach, it, describe, after } from 'tman'
import { expect, use } from 'chai'
import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'
import { Mutation } from '../../../../src/storage/modules'
import { PrimaryKeyNotProvided } from '../../../index'
import { fieldIdentifier } from '../../../../src/storage/symbols'
import { MockDatabase, MockDatabaseTable, MockUpdate, MockInsert } from '../../../utils/mocks'

use(SinonChai)

export default describe('Mutation Testcase: ', () => {
  describe('Class: Mutation', () => {
    let fixture: any[]
    let table: any
    let database: any
    const mockTableName = 'MockTable'

    beforeEach(() => {
      fixture = [
        {
          _id: '577b996b841059b6b09f7370',
          content: 'foo',
        },
        {
          _id: '577b996b841059b6b09f7371',
          content: 'bar',
        },
        {
          _id: '577b996b841059b6b09f7372',
          content: 'baz',
        },
      ]

      database = new MockDatabase()
      table = new MockDatabaseTable(mockTableName)
    })

    it('should can be instantiated successfully', () => {
      const instance = new Mutation(database, table, fixture[0])
      expect(instance).is.instanceof(Mutation)
    })

    describe('Method: withId', () => {
      const originFn = Mutation.aggregate
      after(() => {
        Mutation.aggregate = originFn
      })

      it('should be able to mount id', () => {
        const mut = new Mutation(database, table, { foo: 666, bar: 233 })
        mut.withId('id', 42)

        const stub = sinon.stub(Mutation, 'aggregate')

        Mutation.aggregate(database, [mut], [])

        const [m] = stub.args[0][1]
        const meta = { key: 'id', val: 42 }
        expect(m['meta']).to.deep.equal(meta)
      })
    })

    describe('Method: refId', () => {
      it('should be able to return specified Id.', () => {
        fixture.forEach((f, index) => {
          const mut = new Mutation(database, table, f)
          mut.withId('id', index)

          expect(mut.refId()).to.equal(index)
        })
      })
    })

    describe('Method: patch', () => {
      it('should be able to patch the additional compound data.', () => {
        const key = 'content'
        const muts = fixture.map((f, index) => {
          const mut = new Mutation(database, table, f)
          mut.withId('i', index).patch({
            [key]: f[key] + index,
          })
          return mut
        })

        const { queries } = Mutation.aggregate(database, [], muts)

        queries.forEach((q, i) => {
          expect((q as any).params.content).is.ok
          expect((q as any).params.content).is.equal(`${fixture[i][key]}${i}`)
        })
      })
    })

    describe('Static Method: aggregate', () => {
      it('should be able to transform mutations to queries which will be executed as update statement', () => {
        const muts = fixture.map((item, index) => {
          const mut = new Mutation(database, table, item)
          mut.withId('id', index)
          return mut
        })

        const { contextIds, queries } = Mutation.aggregate(database, [], muts)

        queries.forEach((q) => expect(q).is.instanceOf(MockUpdate))

        expect(contextIds).have.lengthOf(0)
        expect(queries).have.lengthOf(3)
      })

      it('should be able to transform mutations to queries which will be executed as insert statement', () => {
        const muts = fixture.map((item, index) => {
          return new Mutation(database, table, item).withId('id', index)
        })

        const { contextIds, queries } = Mutation.aggregate(database, muts, [])

        queries.forEach((q) => expect(q).is.instanceOf(MockInsert))
        contextIds
          .sort((x, y) => x - y)
          .forEach((k, i) => expect(k).is.equal(fieldIdentifier(mockTableName, i.toString())))

        expect(contextIds).have.lengthOf(3)
        expect(queries).have.lengthOf(1)
      })

      it('should be able to aggregate insert mutation which is reference to the same table.', () => {
        const mutList = fixture.map((f, index) => {
          const name = index % 2 === 0 ? `Even` : 'Odd'
          const mut = new Mutation(database, new MockDatabaseTable(name) as any, f)
          mut.withId('id', index)
          return mut
        })

        const { contextIds, queries } = Mutation.aggregate(database, mutList, [])

        expect(queries).have.lengthOf(Math.ceil(fixture.length / 2))
        expect(contextIds).have.lengthOf(3)
      })

      it('should throw when try to aggregate an unspecified mutation.', () => {
        const standardErr = PrimaryKeyNotProvided()

        const mut1 = [new Mutation(database, table, fixture[0])]
        const mut2 = [new Mutation(database, table, fixture[1])]

        const check1 = () => Mutation.aggregate(database, mut1, [])
        const check2 = () => Mutation.aggregate(database, [], mut2)

        expect(check1).throw(standardErr.message)
        expect(check2).throw(standardErr.message)
      })

      it('should skip the `toUpdater` once params is empty', () => {
        const mut = new Mutation(database, table)
        const { queries } = Mutation.aggregate(database, [], [mut])

        expect(queries).have.lengthOf(0)
      })
    })
  })
})
