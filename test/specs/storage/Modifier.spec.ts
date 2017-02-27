import { beforeEach, it, describe } from 'tman'
import { expect } from 'chai'
import { Modifier } from '../../../src/storage/Modifier'
import { PRIMARY_KEY_NOT_PROVIDED_ERR } from '../../index'
import { MockDatabase, MockDatabaseTable } from '../../utils/MockLovefield'

export default describe('Modifier test', () => {

  let fixture: any[]
  let table: any
  let database: any

  beforeEach(() => {
    fixture = [{
      '_id': '577b996b841059b6b09f7370',
      'content': 'foo',
    }, {
      '_id': '577b996b841059b6b09f7371',
      'content': 'bar'
    }, {
      '_id': '577b996b841059b6b09f7372',
      'content': 'baz'
    }]

    database = new MockDatabase()
    table = new MockDatabaseTable()
  })

  it('shoud be able to transform to Updater', () => {
    fixture.forEach((item, index) => {
      const mod = new Modifier(database, table, item)
      mod.assignPk('id', index)
      const updater = mod.toUpdater()

      expect(updater).to.be.ok
    })
  })

  it('should be able to transform to Row', () => {
    fixture.forEach((item, index) => {
      const mod = new Modifier(database, table, item)
      mod.assignPk('id', index)
      const row = mod.toRow()

      expect(row).to.be.ok
    })
  })

  it('should be able to patch the payload', () => {
    fixture.forEach((f, index) => {
      const key = 'content'
      const mod = new Modifier(database, table, f)
      mod.assignPk('id', index).patch({
        [key]: f[key] + index
      })

      expect(mod.toUpdater().valueOf()).to.deep.equal({
        ...f,
        [key]: f[key] + index
      })
    })
  })

  it('should throw when try to transform itself to Updater/Row without Id', () => {
    const standardErr = PRIMARY_KEY_NOT_PROVIDED_ERR()
    fixture.forEach((f) => {
      const mod = new Modifier(database, table, f)
      try {
        mod.toUpdater()
      } catch (e) {
        expect(e.message).to.equal(standardErr.message)
      }

      try {
        mod.toRow()
      } catch (e) {
        expect(e.message).to.equal(standardErr.message)
      }
    })
  })

  it('should be able to return its Id', () => {
    fixture.forEach((f, index) => {
      const mod = new Modifier(database, table, f)
      mod.assignPk('id', index)

      expect(mod.refId()).to.equal(index)
    })
  })

  it('should be able to concat rows that have same tableName', () => {
    const mods = fixture.map((f, index) => {
      const name = index % 2 === 0 ? `Even` : 'Odd'
      const mod = new Modifier(database, new MockDatabaseTable(name) as any, f)
      mod.assignPk('id', index)
      return mod
    })

    const { preparedKeys, insertQueries } = Modifier.concatToInserter(database, mods)

    expect(insertQueries).have.lengthOf(Math.ceil(fixture.length / 2))
    expect(preparedKeys).have.lengthOf(3)
  })

})
