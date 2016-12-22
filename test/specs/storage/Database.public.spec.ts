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
  NON_EXISTENT_TABLE_ERR,
  ALIAS_CONFLICT_ERR,
  UNEXPECTED_ASSOCIATION_ERR,
  INVALID_ROW_TYPE_ERR
} from '../../index'
import taskGenerator from '../../utils/taskGenerator'
import { TestFixture, TestFixture2 } from '../../schemas/Test'

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

    it('should create database$ Observable', function* () {
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

    it('should throw when alias conflict in table design', () => {
      const meta = Database['schemaMetaData']
      const hooks = Database['hooks']

      Database['schemaMetaData'] = new Map()
      TestFixture(true)

      const standardErr = ALIAS_CONFLICT_ERR('id', 'Test')
      try {
        const db = new Database()
        expect(db).is.undefined
      } catch (err) {
        expect(err.message).to.equal(standardErr.message)
      } finally {
        Database['schemaMetaData'] = meta
        Database['hooks'] = hooks
      }
    })

    it('should throw when association is unexpected, should be one of oneToOne, oneToMany, manyToMany', () => {
      const meta = Database['schemaMetaData']
      const hooks = Database['hooks']

      Database['schemaMetaData'] = new Map()
      TestFixture()

      const standardErr = UNEXPECTED_ASSOCIATION_ERR()
      try {
        // tslint:disable-next-line
        new Database()
      } catch (err) {
        expect(err.message).to.equal(standardErr.message)
      } finally {
        Database['schemaMetaData'] = meta
        Database['hooks'] = hooks
      }
    })

    it('should throw if RDBType is incorrect', () => {
      const meta = Database['schemaMetaData']
      const hooks = Database['hooks']

      Database['schemaMetaData'] = new Map()
      TestFixture2()

      const standardErr = INVALID_ROW_TYPE_ERR()
      try {
        // tslint:disable-next-line
        new Database()
      } catch (err) {
        expect(err.message).to.equal(standardErr.message)
      } finally {
        Database['schemaMetaData'] = meta
        Database['hooks'] = hooks
      }
    })

  })

  describe('insert, get, update', () => {
    let storeResult: TaskSchema[]
    let taskData: TaskSchema

    let expectResult: TaskSchema

    beforeEach(function* () {
      taskData = taskGenerator(1)[0]
      expectResult = clone(taskData)
      const storeTask = clone(taskData)
      delete expectResult.subtasks
      delete expectResult.project
      expectResult['__hidden__created'] = expectResult.created
      expectResult.created = new Date(expectResult.created) as any
      storeResult = yield database.insert('Task', storeTask)
    })

    describe('Database.prototype.insert', () => {
      it('should return data by fields', () => {
        // 因为这里不是通过alias convert输出的，所以这里会吐出真实的数据，而不是 created => __hidden__created 的映射
        // 因此 expectResult.created 仍然是一个真实的DateTime类型
        expect(storeResult).to.deep.equal([expectResult])
      })

      it('virtual property should store seprately', function* () {
        const subtask = taskData.subtasks[0]

        const [result1] = yield database.get<ProjectSchema>('Project', {
          primaryValue: taskData.project._id as string
        }).values()

        expect(result1._id).to.equal(taskData.project._id)
        expect(result1.name).to.equal(taskData.project.name)

        const [result2] = yield database.get<SubtaskSchema>('Subtask', {
          primaryValue: subtask._id as string
        }).values()

        expect(result2._id).to.equal(subtask._id)
        expect(result2.content).to.equal(subtask.content)
        expect(result2._taskId).to.equal(subtask._taskId)
      })

      describe('insert data into table without any hooks', () => {
        it('should insert single row', function* () {
          const project = taskGenerator(1).pop().project
          yield database.insert('Project', project)
          const [result] = yield database.get('Project', {
            where: (table) => table['_id'].eq(project._id as any)
          }).values()

          expect(result).deep.equals(project)
        })

        it('should insert multi rows', function* () {
          const projects = taskGenerator(5).map((task) => task.project)
          const name = 'foo'
          projects.forEach((project) => project.name = name)

          yield database.insert('Project', projects)
          const results = yield database.get('Project', {
            where: (table) => table['name'].eq(name)
          }).values()

          expect(results).deep.equals(projects)
        })
      })
    })

    describe('Database.prototype.get', () => {
      it('should get correct fields', function* () {
        yield database.insert('Task', {
          _id: '1112',
          _projectId: 'haha',
          note: 'note',
          content: 'content',
          _stageId: 'stageId'
        })

        const [result] = yield database.get<TaskSchema>('Task', {
          primaryValue: '1112'
        }).values()

        const undef = 'UNDEF'

        expect(result[undef]).to.be.undefined
        expect(result['_id']).is.equals('1112')
      })

      it('should throw when try to get data from non-existent table', function* () {
        const tableName = 'NON_EXISTENT_FOO_TABLE'
        try {
          yield database.get(tableName).values()
        } catch (e) {
          const standardErr = NON_EXISTENT_TABLE_ERR(tableName)
          expect(e.message).equals(standardErr.message)
        }
      })

      it('should get current fields when get with query', function* () {
        const [result] = yield database.get<TaskSchema>('Task', {
          fields: ['note'], primaryValue: taskData._id as string
        }).values()

        expect(result.note).to.equal(taskData.note)
        expect(result._id).to.be.undefined
      })

      it('should be ok when fileds include not exist field', function* () {
        const undef = 'UNDEF'
        const [result] = yield database.get<TaskSchema>('Task', {
          fields: [undef, 'note'], primaryValue: taskData._id as string
        }).values()

        expect(result.note).to.equal(taskData.note)
        expect((result as any)['undef']).to.be.undefined
      })

      it('should get empty array when query is not match any result', function* () {
        const result = yield database.get<TaskSchema>('Task', { primaryValue: 'testtask' }).values()
        expect(result).deep.equal([])
      })

      it('should throw when fields only include virtual field', function* () {
        try {
          yield database.get('Task', {
            fields: [
              'project', 'subtasks'
            ],
            primaryValue: taskData._id as string
          }).values()

          throw new TypeError('Invalid code path reached!')
        } catch (err) {
          const standardErr = INVALID_FIELD_DES_ERR()
          expect(err.message).to.equal(standardErr.message)
        }
      })

      it('should get correct result when passin partial query fields', function* () {
        const [{ project }] = yield database.get<TaskSchema>('Task', {
          fields: [
            '_id', {
              project: ['_id'],
              subtasks: ['_id', 'name']
            }
          ],
          primaryValue: taskData._id as string
        }).values()

        const expectProject = clone(taskData.project)
        delete expectProject.isArchived
        delete expectProject.name
        delete expectProject.posts

        expect(project).to.deep.equal(expectProject)
      })

    })

    describe('Database.prototype.update', () => {
      const tasks = taskGenerator(10)

      beforeEach(function* () {
        yield database.insert('Task', tasks)
      })

      it('should not update primaryKey', function* () {
        try {
          yield database.update('Task', taskData._id as string, {
            _id: 'fuck'
          })
        } catch (e) {
          const standardErr = UNMODIFIABLE_PRIMARYKEY_ERR()
          expect(e.message).to.equal(standardErr.message)
        }
      })

      it('update virtual props should do nothing', function* () {
        const result1 = yield database.update('Task', taskData._id as string, {
          project: {
            _id: 'project 2',
            name: 'xxx'
          }
        })

        expect(result1).to.be.undefined

        const result2 = yield database.get<ProjectSchema>('Project', {
          primaryValue: 'project 2'
        }).values()

        expect(result2).deep.equal([])

        const [{ project }] = yield database.get<TaskSchema>('Task', {
          fields: [
            '_id', {
              project: ['_id', 'name', 'isArchived'],
              subtasks: ['_id', 'name']
            }
          ],
          primaryValue: taskData._id as string
        }).values()

        expect(project).to.deep.equal(taskData.project)
      })

      it('bulk update should be ok', function* () {
        const newCreated = new Date(2017, 0, 1)
        const data = {
          created: newCreated.toISOString()
        }

        yield database.update('Task', {
          where: (table) => table['created'].isNotNull()
        }, data)

        const [...results] = yield database.get<TaskSchema>('Task', {
          fields: [ 'created']
        }).values()

        results.forEach((r: any) => {
          expect(r.created).to.deep.equal(newCreated.toISOString())
        })
      })

      it('update hidden property should ok', function* () {
        const newCreated = new Date(2017, 1, 1)
        yield database.update('Task', taskData._id as string, {
          created: newCreated.toISOString()
        })

        const [result] = yield database.get<TaskSchema>('Task', {
          fields: ['created']
        }).values()

        expect(result.created).to.deep.equal(newCreated.toISOString())
      })
    })
  })

  describe('Database.prototype.delete', () => {
    const tasks = taskGenerator(30)

    beforeEach(function* () {
      yield database.insert('Task', tasks)
    })

    it('should delete correct values with delete query', function* () {
      const testDate = moment()
      const count = tasks.filter(task => {
        return moment(task.created).valueOf() <= testDate.valueOf()
      }).length

      yield database.delete('Task', {
        where: (table: lf.schema.Table) => {
          return table['created'].gte(testDate.valueOf())
        }
      })

      const result = yield database.get<TaskSchema>('Task').values()
      if (result.length) {
        expect(result.length).to.equal(count)
      } else {
        expect(result).deep.equal([])
      }
    })

    it('should delete correct values with primaryValue', function* () {
      const task = tasks[0]
      yield database.delete('Task', {
        primaryValue: task._id as string
      })

      const result = yield database.get('Task', {
        primaryValue: task._id as string
      }).values()

      expect(result).deep.equal([])
    })

    it('should throw when delete a row from non-exist table', function* () {
      const tableName = 'TestTable-non-exist'
      try {
        yield database.delete(tableName)
      } catch (e) {
        expect(e.message).to.equal(NON_EXISTENT_TABLE_ERR(tableName).message)
      }
    })
  })

  describe('Query relational data', () => {
    const fixture = taskGenerator(1).pop()

    beforeEach(function* () {
      yield database.insert('Task', fixture)
    })

    it('should get correct result', function* () {
      const rets = yield database.get<TaskSchema>('Task').values()

      expect(rets.length).to.equal(1)
      expect(rets[rets.length - 1]).deep.equal(fixture)
    })
  })

})
