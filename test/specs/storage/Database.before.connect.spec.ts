import * as lf from 'lovefield'
import { describe, it, beforeEach } from 'tman'
import { expect } from 'chai'
import { concatMap } from 'rxjs/operators'

import {
  RDBType,
  Database,
  Relationship,
  DataStoreType,
  PrimaryKeyNotProvided,
  DatabaseIsNotEmpty,
  UnmodifiableTable
} from '../../index'

export default describe('Database Method before Connect', () => {

  let i = 1
  let database: Database
  const tablename = 'TestTable'

  beforeEach(() => {
    const dbname = `TestDatabase${i++}`
    database = new Database(DataStoreType.MEMORY, false, dbname, i)
  })

  describe('Database.prototype.defineSchema', () => {
    it('should throw since primaryKey wasn\'t specified', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING
        }
      }
      const define = () => {
        database.defineSchema(tablename, metaData)
      }
      const err = PrimaryKeyNotProvided()
      expect(define).to.throw(err.message)
    })

    it('should throw when user try to re-define a table', () => {
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
      const err = UnmodifiableTable()
      expect(define).to.throw(err.message)
    })

    it('should store in Database', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        },
        name: {
          type: RDBType.STRING
        },
        juju: {
          type: Relationship.oneToOne,
          virtual: {
            name: 'JuJu',
            where: (data: lf.schema.Table) => ({
              name: data['name']
            })
          }
        }
      }
      database.defineSchema(tablename, metaData)
      expect(database['schemaDefs'].get(tablename)).to.equal(metaData)
    })

    it('should throw since try to define a table after connect', () => {
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

      const err = UnmodifiableTable()
      expect(db).is.not.null
      expect(define).to.throw(err.message)
    })
  })

  describe('Database.prototype.load', () => {

    let db: Database
    let fixedVersion = 1000
    let dbname: string = null

    beforeEach(() => {
      dbname = `TestDatabase${fixedVersion++}`
      db = new Database(DataStoreType.MEMORY, false, dbname, fixedVersion)
    })

    it('should be preload data before connect', (done) => {
      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        }
      }
      db.defineSchema('Preload', metaData)

      const tableName = 'Preload'
      const fixture = { name: dbname, version: fixedVersion, tables: { [tableName]: [ { _id: 'foo' }, { _id: 'bar' } ] } }

      db.load(fixture).pipe(concatMap(() => {
        return db.dump()
      }))
      .subscribe((dump: any) => {
        expect(dump.tables[tableName]).have.lengthOf(2)
        expect(db['storedIds'].size).to.equal(2)
        done()
      })

      db.connect()
    })

    it('should throw once database is connected', () => {
      const metaData = {
        _id: {
          type: RDBType.STRING,
          primaryKey: true
        }
      }
      db.defineSchema('Preload', metaData)

      db.connect()
      const check = () => {
        const tableName = 'Preload'
        const fixture = { name: dbname, version: 2, tables: { [tableName]: [ { _id: 'foo' }, { _id: 'bar' } ] } }
        db.load(fixture)
      }

      expect(check).to.throw(DatabaseIsNotEmpty().message)
    })

  })

})
