import * as lf from 'lovefield'
import { describe, it, beforeEach } from 'tman'
import { expect } from 'chai'
import { Database, RDBType } from '../../index'

export default describe('Database static Method', () => {

  let tablename = ''
  let i = 0

  beforeEach(() => {
    tablename = `TestTable${i++}`
  })

  describe('Database.defineSchema', () => {
    it('should throw without primaryKey', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING
        }
      }
      const define = () => {
        Database.defineSchema(tablename, metaData)
      }
      expect(define).to.throw(`No primaryKey key give in schemaMetaData: ${JSON.stringify(metaData, null, 2)}`)
    })

    it('should throw when redefine a table', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        }
      }
      const define = () => {
        Database.defineSchema(tablename, metaData)
        Database.defineSchema(tablename, metaData)
      }
      expect(define).to.throw(`Can not redefine table: ${tablename}`)
    })

    it('should store in Database.schemaMetaData', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        },
        name: {
          type: RDBType.STRING
        },
        juju: {
          type: RDBType.OBJECT,
          virtual: {
            name: 'JuJu',
            fields: ['_id', 'name', 'age'],
            where: (table: lf.schema.Table, data: any) => {
              return table['name'].eq(data.name)
            }
          }
        }
      }
      Database.defineSchema(tablename, metaData)
      expect(Database['schemaMetaData'].get(tablename)).to.equal(metaData)
    })
  })

  describe('Database.defineHook', () => {
    it('should return hookDef', () => {
      Database.defineSchema(tablename, {
        _id: {
          primaryKey: true,
          type: RDBType.STRING
        },
        name: {
          type: RDBType.STRING
        }
      })
      const hookMetadata = {
        insert: (db: lf.Database, entity: any) => Promise.resolve({ db, entity })
      }
      const hookDef = Database.defineHook(tablename, hookMetadata)
      expect(hookDef).to.equal(hookMetadata)
    })

    it('should add hookDef to Database.hooks', () => {
      Database.defineSchema(tablename, {
        _id: {
          primaryKey: true,
          type: RDBType.STRING
        },
        name: {
          type: RDBType.STRING
        }
      })
      const storeFunc = (db: lf.Database, entity: any) => Promise.resolve({ db, entity })
      const hookMetadata = { insert: storeFunc }
      Database.defineHook(tablename, hookMetadata)
      expect(Database['hooks'].get(tablename).insert).to.deep.equal([storeFunc])
    })

    it('should throw before defineSchema', () => {
      const define = () => {
        Database.defineHook(tablename, {})
      }
      expect(define).to.throw(`you should defineSchema before you defineHook: ${tablename}`)
    })
  })
})
