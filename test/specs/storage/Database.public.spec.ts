import { Observable } from 'rxjs/Observable'
import * as moment from 'moment'
import { describe, it, beforeEach, afterEach } from 'tman'
import { expect, assert } from 'chai'
import {
  Database,
  ProjectSchema,
  SubtaskSchema,
  TaskSchema,
  clone,
  INVALID_FIELD_DES_ERR,
  UNMODIFIABLE_PRIMARYKEY_ERR,
  NON_EXISTENT_TABLE_ERR
} from '../../index'
import taskGenerator from '../../utils/taskGenerator'

export default describe('Database public Method', () => {

  let database: Database

  require('../../schemas')
  const originMetaData = Database['schemaMetaData']

  beforeEach(() => {
    Database['schemaMetaData'] = originMetaData
    database = new Database()
  })

  afterEach(() => {
    return database.dispose()
  })

  describe('Database.prototype.constructor', () => {

    it('should be instanceof Database', () => {
      expect(database).to.be.instanceof(Database)
    })

    it('should create database$ Observable', function *() {
      expect(database.database$).to.be.instanceof(Observable)
      yield database.database$
        .do(db => {
          expect(db.getSchema().name()).to.equal('ReactiveDB')
        })
    })

    it('should delete schemaMetaData property on Database', () => {
      expect(Database['schemaMetaData']).to.be.undefined
    })

    it('should store primaryKeys in primaryKeysMap', () => {
      database['primaryKeysMap'].forEach(val => {
        expect(val).to.equal('_id')
      })
    })

    it('should store selectMetaData', () => {
      const taskSelectMetaData = database['selectMetaData'].get('Task')
      expect(taskSelectMetaData.fields).to.deep.equal(new Set(['_id', 'content', 'note', '_projectId']))
      expect(taskSelectMetaData.virtualMeta.get('project').name).to.equal('Project')
      assert.isFunction(taskSelectMetaData.virtualMeta.get('project').where)
    })
  })

  describe('store, get, update', () => {
    let storeResult: TaskSchema[]
    let taskData: TaskSchema

    let expectResult: TaskSchema

    beforeEach(function *() {
      taskData = taskGenerator(1)[0]
      expectResult = clone(taskData)
      const storeTask = clone(taskData)
      delete expectResult.subtasks
      delete expectResult.project
      expectResult['__hidden__created'] = expectResult.created
      expectResult.created = new Date(expectResult.created) as any
      storeResult = yield database.insert('Task', storeTask)
    })

    describe('Database.prototype.store', () => {
      it('should return data by fields', () => {
        expect(storeResult[0]).to.deep.equal(expectResult)
      })

      it('virtual property should store seprately', async function () {
        const subtask = taskData.subtasks[0]

        await database.get<ProjectSchema>('Project', {
          primaryValue: taskData.project._id as string
        })
          .values()
          .do(([r]) => {
            expect(r._id).to.equal(taskData.project._id)
            expect(r.name).to.equal(taskData.project.name)
          })
          .toPromise()

        await database.get<SubtaskSchema>('Subtask', {
          primaryValue: subtask._id as string
        })
          .values()
          .do(([r]) => {
            expect(r._id).to.equal(subtask._id)
            expect(r.content).to.equal(subtask.content)
            expect(r._taskId).to.equal(subtask._taskId)
          })
          .toPromise()
      })
    })

    describe('Database.prototype.get', () => {
      it('should get correct fields', async function () {
        await database.insert('Task', {
          _id: '1112',
          _projectId: 'haha',
          note: 'note',
          content: 'content',
          _stageId: 'stageId'
        })
          .toPromise()

        await database.get<TaskSchema>('Task', {
          primaryValue: '1112'
        })
          .values()
          .do(r => {
            expect(r['xxx']).to.be.undefined
          })
          .toPromise()
      })

      it('should throw when try to get data from non-existent table', async function() {
        const tableName = 'NON_EXISTENT_FOO_TABLE'
        try {
          await database.get(tableName).values().toPromise()
        } catch (e) {
          let standardErr = NON_EXISTENT_TABLE_ERR(tableName)
          expect(e.message).equals(standardErr.message)
        }
      })

      it('should get current fields when get with query', function *() {
        yield database.get<TaskSchema>('Task', { fields: ['note'], primaryValue: taskData._id as string })
          .values()
          .do(([r]) => {
            expect(r.note).to.equal(taskData.note)
            expect(r._id).to.be.undefined
          })
      })

      it('should be ok when fileds include not exist field', function *() {
        yield database.get<TaskSchema>('Task', { fields: ['xxx', 'note'], primaryValue: taskData._id as string })
          .values()
          .do(([r]) => {
            expect(r.note).to.equal(taskData.note)
            expect((<any>r).xxx).to.be.undefined
          })
      })

      it('should get null when query is not match any result', function *() {
        yield database.get<TaskSchema>('Task', { primaryValue: 'testtask' })
          .values()
          .do((r) => expect(r).to.be.null)
      })

      it('should throw when fields only include virtual field', function *() {
        yield database.get('Task', { fields: ['project'] })
          .values()
          .catch(err => {
            const standardErr = INVALID_FIELD_DES_ERR()
            expect(err.message).to.equal(standardErr.message)
            return Observable.of(null)
          })
      })
    })


    describe('Database.prototype.update', () => {
      const tasks = taskGenerator(10)

      beforeEach(async function () {
        await database.insert('Task', tasks).toPromise()
      })

      it('should not update primaryKey', function *() {
        yield database.update('Task', taskData._id as string, {
          _id: 'fuck'
        })
          .catch(e => {
            const err = UNMODIFIABLE_PRIMARYKEY_ERR()
            expect(e.message).to.equal(err.message)
            return Observable.of(null)
          })
      })

      it('update virtual props should do nothing', function* () {
        yield database.update('Task', taskData._id as string, {
          project: {
            _id: 'project 2',
            name: 'xxx'
          }
        })
          .do(r => {
            expect(r).to.be.undefined
          })

        yield database.get<ProjectSchema>('Project', {
          primaryValue: 'project 2'
        })
          .values()
          .do(r => expect(r).to.be.null)

        yield database.get<TaskSchema>('Task', {
          fields: [
            '_id', {
              project: ['_id', 'name'],
              subtasks: ['_id', 'name']
            }
          ],
          primaryValue: taskData._id as string
        })
          .values()
          .do(([{ project }]) => expect(project).to.deep.equal({
            _id: taskData.project._id,
            name: taskData.project.name
          }))
      })

      it('bulk update should be ok', function* () {
        const newCreated = new Date(2017, 1, 1)
        const data = {
          created: newCreated.toISOString()
        }

        yield database.update('Task', {
          where: (table) => table['created'].isNotNull()
        }, data)

        yield database.get<TaskSchema>('Task', {
          fields: ['created', '__hidden__created']
        })
          .values()
          .do(([...rets]) => {
            rets.forEach((r) => {
              expect(r.created).to.deep.equal(newCreated)
              expect(r['__hidden__created']).to.deep.equal(newCreated.toISOString())
            })
          })
      })

      it('update hidden property should ok', function *() {
        const newCreated = new Date(2017, 1, 1)
        yield database.update('Task', taskData._id as string, {
          created: newCreated.toISOString()
        })

        yield database.get<TaskSchema>('Task', {
          fields: ['created', '__hidden__created']
        })
          .values()
          .do(([r]) => expect(r.created).to.deep.equal(newCreated))
      })
    })
  })

  describe('Database.prototype.delete', () => {
    const tasks = taskGenerator(30)

    beforeEach(async function () {
      await database.insert('Task', tasks).toPromise()
    })

    it('should delete correct values with delete query', function *() {
      const testDate = moment()
      const count = tasks.filter(task => {
        return moment(task.created).valueOf() <= testDate.valueOf()
      })
        .length
      yield database.delete('Task', {
        where: (table: lf.schema.Table) => {
          return table['created'].gte(testDate.valueOf())
        }
      })
      yield database.get<TaskSchema>('Task')
        .values()
        .do(r => {
          if (r) {
            expect(r.length).to.equal(count)
          } else {
            expect(r).to.be.null
          }
        })
    })

    it('should delete correct values with primaryValue', function *() {
      const task = tasks[0]
      yield database.delete('Task', {
        primaryValue: task._id as string
      })

      yield database.get('Task', {
        primaryValue: task._id as string
      })
        .values()
        .do(r => expect(r).to.be.null)
    })

    it('should throw when delete a row from non-exist table', done => {
      const tableName = 'TestTable-non-exist'
      database.delete(tableName)
        .catch(e => {
          expect(e.message).to.equal(NON_EXISTENT_TABLE_ERR(tableName).message)
          return Promise.resolve()
        })
        .subscribe(done)
    })
  })
})
