import * as lf from 'lovefield'
import { describe, it, beforeEach } from 'tman'
import { expect } from 'chai'
import {
  Database,
  RDBType,
  DataStoreType,
  Association,
  NON_EXISTENT_PRIMARY_KEY_ERR,
  UNMODIFIABLE_TABLE_SCHEMA_ERR,
  DEFINE_HOOK_ERR,
  UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR
} from '../../index'

export default describe('Database Method before Connect', () => {

  let dbname = 'TestDatabase0'
  const tablename = 'TestTable'
  let i = 1
  let database: Database

  beforeEach(() => {
    dbname = `TestDatabase${i++}`
    database = new Database(DataStoreType.MEMORY, false, dbname, i)
  })

  describe('Database.prototype.defineSchema', () => {
    it('should throw without primaryKey', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING
        }
      }
      const define = () => {
        database.defineSchema(tablename, metaData)
      }
      const err = NON_EXISTENT_PRIMARY_KEY_ERR(metaData)
      expect(define).to.throw(err.message)
    })

    it('should throw when redefine a table', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        }
      }
      const define = () => {
        database.defineSchema(tablename, metaData)
        database.defineSchema(tablename, metaData)
      }
      const err = UNMODIFIABLE_TABLE_SCHEMA_ERR(tablename)
      expect(define).to.throw(err.message)
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
          type: Association.oneToOne,
          virtual: {
            name: 'JuJu',
            where: (data: lf.schema.Table) => ({
              name: data['name']
            })
          }
        }
      }
      database.defineSchema(tablename, metaData)
      expect(database['schemaMetaData'].get(tablename)).to.equal(metaData)
    })

    it('should throw after Database connect', () => {
      const db = new Database(DataStoreType.MEMORY, false)

      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        }
      }

      db.connect()

      const define = () => {
        db.defineSchema(tablename, metaData)
        db.defineSchema(tablename, metaData)
      }

      const err = UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR()
      expect(db).is.not.null
      expect(define).to.throw(err.message)
    })
  })

  describe('Database.prototype.defineHook', () => {
    it('should throw after connect', () => {
      const db = new Database(DataStoreType.MEMORY, false)

      db.connect()

      const define = () => {
        db.defineHook(tablename, { })
      }

      const err = UNMODIFIABLE_TABLE_SCHEMA_AFTER_INIT_ERR()
      expect(db).is.not.null
      expect(define).to.throw(err.message)
    })

    it('should return hookDef', () => {
      database.defineSchema(tablename, {
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
      const hookDef = database.defineHook(tablename, hookMetadata)
      expect(hookDef).to.equal(hookMetadata)
    })

    it('should add hookDef to Database.hooks', () => {
      database.defineSchema(tablename, {
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
      database.defineHook(tablename, hookMetadata)
      expect(database['hooks'].get(tablename).insert).to.deep.equal([storeFunc])
    })

    it('should throw before defineSchema', () => {
      const define = () => {
        database.defineHook(tablename, {})
      }
      const err = DEFINE_HOOK_ERR(tablename)
      expect(define).to.throw(err.message)
    })
  })
})
