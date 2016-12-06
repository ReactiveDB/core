import * as lf from 'lovefield'
import { expect } from 'chai'
import { beforeEach, it, describe, afterEach } from 'tman'
import { SelectMeta, lfFactory } from '../../index'

export default describe('SelectMeta test', () => {
  let db: lf.Database
  let table: lf.schema.Table

  beforeEach(function * () {
    const schemaBuilder = lf.schema.create('SelectMetaTest', 1)
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
  })

  afterEach(() => {
    db.close()
  })

  it('SelectMeta.constructor', () => {
    const selectMeta = new SelectMeta(db, db.select().from(table), (values: any[]) => values)
    expect(selectMeta).to.be.instanceof(SelectMeta)
  })

  it('SelectMeta.prototype.getValues', async function () {
    const selectMeta = new SelectMeta(db, db.select().from(table), (values: any[]) => {
      return values.map(value => {
        value.folded = 'true'
        return value
      })
    }, table['time'].gte(50))
    const rows: lf.Row[] = []
    for (let i = 0; i < 1000; i ++) {
      rows.push(table.createRow({
        _id: `_id:${i}`,
        name: 'name:${i}',
        time: i
      }))
    }
    await db.insert().into(table).values(rows).exec()
    const values = await selectMeta.getValue()
    expect(values.length).to.equal(1000 - 50)
    values.forEach(value => {
      expect(value.folded).to.equal('true')
    })
  })
})
