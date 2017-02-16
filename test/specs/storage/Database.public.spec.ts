import { Observable } from 'rxjs/Observable'
import * as moment from 'moment'
import { describe, it, beforeEach, afterEach } from 'tman'
import { expect, assert } from 'chai'
import {
  RDBType,
  Database,
  ProjectSchema,
  SubtaskSchema,
  TaskSchema,
  PostSchema,
  ProgramSchema,
  ModuleSchema,
  ExecutorResult,
  clone,
  INVALID_FIELD_DES_ERR,
  HOOK_EXECUTE_FAILED,
  NON_EXISTENT_TABLE_ERR,
  ALIAS_CONFLICT_ERR,
  UNEXPECTED_ASSOCIATION_ERR,
  INVALID_ROW_TYPE_ERR,
  INVALID_PATCH_TYPE_ERR,
  PRIMARY_KEY_NOT_PROVIDED_ERR
} from '../../index'
import { uuid } from '../../utils/uuid'
import taskGenerator from '../../utils/taskGenerator'
import postGenerator from '../../utils/postGenerator'
import { default as relationalDataGenerator, ProgramGenerator } from '../../utils/relationalDataGenerator'
import schemaFactory from '../../schemas'
import { TestFixture, TestFixture2 } from '../../schemas/Test'

export default describe('Database public Method', () => {

  let database: Database

  const originMetaData = Database['schemaMetaData']

  beforeEach(() => {
    Database['schemaMetaData'] = originMetaData
    database = new Database()
    schemaFactory(database)
    database.connect()
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
      expect(database['primaryKeysMap'].size).to.equal(database['selectMetaData'].size)
    })

    it('should store selectMetaData', () => {
      const taskSelectMetaData = database['selectMetaData'].get('Task')

      expect(taskSelectMetaData.fields).to.deep.equal(new Set(['_id', 'content', 'note', '_projectId']))
      expect(taskSelectMetaData.virtualMeta.get('project').name).to.equal('Project')
      assert.isFunction(taskSelectMetaData.virtualMeta.get('project').where)
    })

    it('should throw when alias conflict in table design', () => {
      const testDb = new Database()
      TestFixture(true)(testDb)

      const standardErr = ALIAS_CONFLICT_ERR('id', 'Fixture1')
      try {
        testDb.connect()
      } catch (err) {
        expect(err.message).to.equal(standardErr.message)
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
      const testDb = new Database()

      TestFixture2(testDb)

      const standardErr = INVALID_ROW_TYPE_ERR()
      try {
        testDb.connect()
      } catch (err) {
        expect(err.message).to.equal(standardErr.message)
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
      expectResult.created = new Date(expectResult.created).valueOf() as any
      expectResult['__hidden__involveMembers'] = expectResult.involveMembers
      expectResult.involveMembers = expectResult.involveMembers.join('|') as any
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

        const [ result1 ] = yield database.get<ProjectSchema>('Project', {
          where: {
            _id: taskData.project._id as string
          }
        }).values()

        expect(result1._id).to.equal(taskData.project._id)
        expect(result1.name).to.equal(taskData.project.name)

        const [ result2 ] = yield database.get<SubtaskSchema>('Subtask', {
          where: { _id: subtask._id as string }
        }).values()

        expect(result2._id).to.equal(subtask._id)
        expect(result2.content).to.equal(subtask.content)
        expect(result2._taskId).to.equal(subtask._taskId)
      })

      it('should be ok when insert data which its virtual property was already stored', function* () {
        const [ task ] = taskGenerator(1)
        const name = 'foo'
        task.project = { ...taskData.project, name: 'foo' }

        yield database.insert('Task', task)

        const [ result ] = yield database.get('Project', {
          where: {
            _id: taskData.project._id
          }
        }).values()

        expect(result.name).to.equal(name)
      })

      it('should throw when insert hook execute failed', function* () {
        const db = new Database(void 0, void 0, 'TestInsertHookFail')
        const typeErr = new TypeError('Oh error')
        db.defineSchema('TestTable', {
          pk: {
            type: RDBType.STRING,
            primaryKey: true
          }
        })
        db.defineHook('TestTable', {
          insert: () => {
            throw typeErr
          }
        })

        db.connect()

        const err = HOOK_EXECUTE_FAILED('insert', typeErr)

        try {
          yield db.insert('TestTable', { pk: '1111' })
        } catch (error) {
          expect(error.message).to.equal(err.message)
        }
      })

      describe('insert data into table without any hooks', () => {
        it('should insert single row', function* () {
          const project = taskGenerator(1).pop().project
          yield database.insert('Project', project)
          const [ result ] = yield database.get('Project', {
            where: {
              _id: project._id as string
            }
          }).values()

          expect(result).deep.equals(project)
        })

        it('should insert multi rows', function* () {
          const projects = taskGenerator(5).map((task) => task.project)
          const name = 'foo'
          projects.forEach((project) => project.name = name)

          yield database.insert('Project', projects)
          const results = yield database.get('Project', {
            where: { name }
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

        const [ result ] = yield database.get<TaskSchema>('Task', {
          where: { _id: '1112' }
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

      it('should be able to get result correctly with a not exactly right query', function* () {
        const [ result ] = yield database.get<TaskSchema>('Task', {
          fields: ['_id', {
            ['__NON_EXISTENT_FIELD__'] : ['_id']
          }], where: {
            _id: taskData._id
          }
        }).values()

        expect(result).have.property('_id', taskData._id)
      })

      it('should get current fields when get with query', function* () {
        const [ result ] = yield database.get<TaskSchema>('Task', {
          fields: ['note'], where: {
            _id: taskData._id
          }
        }).values()

        expect(result.note).to.equal(taskData.note)
        expect(result._id).to.be.undefined
      })

      it('should be ok when fileds include not exist field', function* () {
        const undef = 'UNDEF'
        const [ result ] = yield database.get<TaskSchema>('Task', {
          fields: [undef, 'note'], where: { _id: taskData._id }
        }).values()

        expect(result.note).to.equal(taskData.note)
        expect((result as any)['undef']).to.be.undefined
      })

      it('should get empty array when query is not match any result', function* () {
        const result = yield database.get<TaskSchema>('Task', { where: { _id: 'testtask' } }).values()
        expect(result).deep.equal([])
      })

      it('should throw when fields only include virtual field', function* () {
        try {
          yield database.get('Task', {
            fields: [
              'project', 'subtasks'
            ],
            where: { _id: taskData._id }
          }).values()

          throw new TypeError('Invalid code path reached!')
        } catch (err) {
          const standardErr = INVALID_FIELD_DES_ERR()
          expect(err.message).to.equal(standardErr.message)
        }
      })

      it('should get correct result when passin partial query fields', function* () {
        const [ { project } ] = yield database.get<TaskSchema>('Task', {
          fields: [
            '_id', {
              project: ['_id'],
              subtasks: ['_id', 'name']
            }
          ],
          where: { _id: taskData._id }
        }).values()

        const expectProject = clone(taskData.project)
        delete expectProject.isArchived
        delete expectProject.name
        delete expectProject.posts

        expect(project).to.deep.equal(expectProject)
      })

      it('should throw when build whereClause failed', function* () {
        let result: any[]
        try {
          result = yield database.get<TaskSchema>('Task', {
            where: {
              get whatever() {
                throw new TypeError('error occured when build execute where clause function')
              }
            }
          } as any).values()
        } catch (e) {
          throw new TypeError('Invalid code path reached.')
        }

        expect(result).to.have.length.above(0)
      })

      it('should get value when both pk and whereClause were specified', function* () {
        const task = clone(taskData)
        const [ { _id } ] = yield database.get<TaskSchema>('Task', {
          where: {
            _id: task._id,
            _projectId: task._projectId
          }
        }).values()

        expect(_id).to.equal(task._id)
      })

      it('should ok with skip and limit', function* () {
        yield database.delete('Task')

        const tasks = taskGenerator(100)
        yield database.insert('Task', tasks)

        const result = yield database.get('Task', {
          limit: 10,
          skip: 20
        })
          .values()

        yield Observable.from(tasks)
          .skip(20)
          .take(10)
          .toArray()
          .do(r => {
            expect(r).to.deep.equal(result)
          })
      })

      it('should get correct result with order', function* () {
        yield database.delete('Task')

        const tasks = taskGenerator(20)

        yield database.insert('Task', tasks)

        const result = yield database.get('Task', {
          orderBy: [
            { orderBy: 'ASC', fieldName: 'subtasksCount' },
            { orderBy: 'DESC', fieldName: 'created' },
          ]
        }).values()

        tasks.sort((a, b) => {
          const moreSubtasks = Math.sign(a.subtasksCount - b.subtasksCount)
          const earlier = -Math.sign(new Date(a.created).valueOf()
                                     - new Date(b.created).valueOf())
          return moreSubtasks * 10 + earlier
        })
          .forEach((r, i) => {
            delete r.subtasks
            delete r.project
            delete result[i].subtasks
            delete result[i].project
            expect(r).to.deep.equal(result[i])
          })
      })

      it('should keep the idempotency of query', function* () {
        const sqlA = yield database.get('Task').toString()
        const sqlB = yield database.get('Task').toString()

        expect(sqlA).to.deep.equal(sqlB)
      })

    })

    describe('Database.prototype.update', () => {
      const tasks = taskGenerator(10)

      beforeEach(function* () {
        yield database.insert('Task', tasks)
      })

      it('should not update primaryKey', function* () {
        const note = 'foo'
        yield database.update('Task', taskData._id as string, {
          _id: 'fuck',
          note
        })

        const [ result ] = yield database.get('Task', {
          where: { _id: taskData._id }
        }).values()

        expect(result._id).eq(taskData._id)
        expect(result.note).eq(note)
      })

      it('update virtual props should do nothing', function* () {
        const result1 = yield database.update<TaskSchema>('Task', {
          where: { _id: taskData._id }
        }, {
          project: {
            _id: 'project 2',
            name: 'xxx'
          }
        })

        expect(result1).to.be.undefined

        const result2 = yield database.get<ProjectSchema>('Project', {
          where: { _id: 'project 2' }
        }).values()

        expect(result2).deep.equal([])

        const [ { project } ] = yield database.get<TaskSchema>('Task', {
          fields: [
            '_id', {
              project: ['_id', 'name', 'isArchived', 'posts'],
              subtasks: ['_id', 'name']
            }
          ],
          where: { _id: taskData._id }
        }).values()

        expect(project).to.deep.equal(taskData.project)
      })

      it('bulk update should be ok', function* () {
        const newCreated = new Date(2017, 0, 1)
        const data = {
          created: newCreated.toISOString()
        }

        yield database.update('Task', {
          where: {
            created: {
              $isNotNull: true
            }
          }
        }, data)

        const results = yield database.get<TaskSchema>('Task', {
          fields: ['created']
        }).values()

        results.forEach((r: any) => {
          expect(r.created).to.deep.equal(newCreated.toISOString())
        })
      })

      it('update property twice should be ok', function* () {
        const clause = {
          where: { _id: taskData._id }
        }

        const u1 = uuid()
        const u2 = uuid()

        yield database.update('Task', clause, {
          _stageId: u1
        })

        const [ r1 ] = yield database.get('Task', {
          where: {
            _stageId: u1
          }
        }).values()

        yield database.update('Task', clause, {
          _stageId: u2
        })

        const [ r2 ] = yield database.get('Task', {
          where: {
            _stageId: u2
          }
        }).values()

        expect(r1._stageId).to.equal(u1)
        expect(r2._stageId).to.equal(u2)
      })

      it('update hidden property should ok', function* () {
        const newCreated = new Date(2017, 1, 1)
        yield database.update('Task', taskData._id as string, {
          created: newCreated.toISOString()
        })

        const [ result ] = yield database.get<TaskSchema>('Task', {
          fields: ['created']
        }).values()

        expect(result.created).to.deep.equal(newCreated.toISOString())
      })

      it('update row via pk should be ok', function* () {
        const task = clone(tasks[0])

        const patchData = {
          note: 'foo'
        }

        yield database.update<TaskSchema>('Task', {
          where: { _id: task._id }
        }, patchData)

        const [ result ] = yield database.get<TaskSchema>('Task', {
          where: {
            note: 'foo'
          }
        }).values()

        expect(result._id).to.equal(task._id)
      })

      it('update navigation property which is already stored should be ok', function* () {
        const task = tasks[0]
        const project = task.project
        const name = 'bar'
        const patch = { name }

        yield database.update<TaskSchema>('Project', {
          where: {
            _id: project._id
          }
        }, patch)

        const [ result ] = yield database.get<TaskSchema>('Task', {
          where: {
            _id: task._id
          }
        }).values()

        expect(result.project.name).to.equal(name)
      })

      it('update without clause should not throw', function* () {
        yield database.delete('Task')

        const [ fixture ] = taskGenerator(1)

        yield database.insert('Task', fixture)

        const newContent = 'new test content'

        yield database.update('Task', { }, {
          content: newContent
        })

        yield database.get<TaskSchema>('Task')
          .values()
          .do(([t]) => {
            expect(t.content).to.equal(newContent)
          })
      })

      it('should throw when patched data is not a single record', function* () {
        const results = yield database.get<TaskSchema>('Task').values()
        const patch = results.map((ret: TaskSchema) => {
          return { ...ret, content: 'bar' }
        })

        try {
          yield database.update('Task', {
            where: {
              _id: {
                $isNotNull: true
              }
            }
          }, patch)
        } catch (e) {
          const standardErr = INVALID_PATCH_TYPE_ERR('Array')
          expect(e.message).to.equal(standardErr.message)
        }
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
        where: {
          created: {
            $gte: testDate.valueOf()
          }
        }
      })

      const result = yield database.get<TaskSchema>('Task').values()
      if (result.length) {
        expect(result).to.have.lengthOf(count)
      } else {
        expect(result).deep.equal([])
      }
    })

    it('should delete correct values with primaryValue', function* () {
      const task = tasks[0]
      yield database.delete('Task', {
        where: { _id: task._id }
      })

      const result = yield database.get('Task', {
        where: { _id: task._id }
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

    it('should throw when delete hook execute failed', function* () {
      const db = new Database(void 0, void 0, 'TestDeleteHookFail')
      const typeErr = new TypeError('Oh error')
      db.defineSchema('TestTable', {
        pk: {
          type: RDBType.STRING,
          primaryKey: true
        }
      })
      db.defineHook('TestTable', {
        destroy: () => {
          throw typeErr
        }
      })

      db.connect()

      yield db.insert('TestTable', { pk: '1111' })

      const err = HOOK_EXECUTE_FAILED('delete', typeErr)

      try {
        yield db.delete('TestTable', {
          where: { pk: '1111' }
        })
      } catch (error) {
        expect(error.message).to.equal(err.message)
      }
    })
  })

  describe('Database.protototype.upsert', () => {

    afterEach(() => {
      database.dispose()
    })

    const checkExecutorResult =
      function (result: ExecutorResult, insertCount: number = 0, deleteCount: number = 0, updateCount: number = 0, selectCount: number = 0) {
        expect(result.result).to.equal(true)
        expect(result).have.property('insert', insertCount)
        expect(result).have.property('delete', deleteCount)
        expect(result).have.property('select', selectCount)
        expect(result).have.property('update', updateCount)
      }

    it('should be able to upsert single record', function* () {
      const post = postGenerator(1, null).pop()
      const execRet = yield database.upsert('Post', post)

      const [ ret ] = yield database.get<PostSchema>('Post', {
        where: {
          _id: post._id
        }
      }).values()

      expect(ret).to.deep.equal(post)
      checkExecutorResult(execRet, 1)
    })

    it('should be able to upsert multi records', function* () {
      const posts: PostSchema[] = postGenerator(10, null)
      const execRet = yield database.upsert<PostSchema>('Post', posts)

      const rets = yield database.get<PostSchema>('Post', {
        where: {
          _id: {
            $in: posts.map(p => p._id)
          }
        }
      }).values()

      expect(posts).to.deep.equal(rets)
      checkExecutorResult(execRet, 10)
    })

    it('should be able to upsert single record with its association property', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = ProgramGenerator(programCount, moduleCount).pop()
      const execRet = yield database.upsert<ProgramSchema>('Program', program)

      const [ ret ] = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: program._id
        }
      }).values()

      expect(ret).to.deep.equal(program)
      checkExecutorResult(execRet, programCount + (moduleCount * 2))
    })

    it('should be able to upsert multi records with their association property', function* () {
      const programCount = 2
      const moduleCount = 8

      const programs = ProgramGenerator(programCount, moduleCount)
      const execRet = yield database.upsert<ProgramSchema>('Program', programs)

      const rets = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: {
            $in: programs.map(p => p._id)
          }
        }
      }).values()

      expect(programs).to.deep.equal(rets)
      checkExecutorResult(execRet, programCount + moduleCount * 2)
    })

    it('should be merge duplicated record which have same id [1]', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = ProgramGenerator(programCount, moduleCount).pop()
      const programs = [program, program]
      const execRet = yield database.upsert<ProgramSchema>('Program', programs)

      const [ ret ] = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: program._id
        }
      }).values()

      const rows = programs.length * (programCount + (moduleCount * 2))

      expect(ret).to.deep.equal(program)
      checkExecutorResult(execRet, rows / 2)
    })

    it('should be merge duplicated record which have same id [2]', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = ProgramGenerator(programCount, moduleCount).pop()
      const programs = [program, { ...program, ownerId: 'foo' }]
      const execRet = yield database.upsert<ProgramSchema>('Program', programs)

      const [ ret ] = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: program._id
        }
      }).values()

      const rows = programs.length * (programCount + (moduleCount * 2))

      expect(ret).to.deep.equal({ ...program, ownerId: 'foo', owner: null })
      checkExecutorResult(execRet, rows / 2)
    })

    it('should be able to handle the record which is already be stored correctly', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = ProgramGenerator(programCount, moduleCount).pop()
      yield database.upsert<ProgramSchema>('Program', program)

      const execRet = yield database.upsert<ProgramSchema>('Program', program)

      const [ ret ] = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: program._id
        }
      }).values()

      expect(ret).to.deep.equal(program)
      checkExecutorResult(execRet, 0, 0, programCount + moduleCount * 2)
    })

    it('should be able to handle the records which contained duplicated association property correctly', function* () {
      const programCount = 1
      const moduleCount = 1

      const program1 = ProgramGenerator(programCount, moduleCount).pop()
      const program2 = ProgramGenerator(programCount, moduleCount).pop()

      program2.modules = program1.modules

      const execRet = yield database.upsert<ProgramSchema>('Program', [program1, program2])

      const rets = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: {
            $in: [program1._id, program2._id]
          }
        }
      }).values()

      expect(rets).to.deep.equal([program1, { ...program2, modules: [] }])
      checkExecutorResult(execRet, programCount * 2 + 1 + moduleCount * 2)
    })

    it('should use `update` to handle the record which is already stored', function* () {
      const programCount = 2
      const moduleCount = 4

      const program1 = ProgramGenerator(programCount, moduleCount).pop()
      const program2 = ProgramGenerator(programCount, moduleCount).pop()

      yield database.upsert<ProgramSchema>('Program', program1)

      const [ mod ] = program1.modules
      program2.modules = [
        {
          _id: (mod as any)._id,
          name: 'foo'
        }
      ]

      const execRet = yield database.upsert<ProgramSchema>('Program', program2)

      const [ ret ] = yield database.get<ModuleSchema>('Module', {
        where: {
          _id: (mod as any)._id
        },
        fields: ['_id', 'name', 'ownerId', 'parentId', {
          programmer: ['_id', 'name']
        }]
      }).values()

      expect(ret).to.deep.equal({ ...mod, name: 'foo' })
      checkExecutorResult(execRet, 1 + 1, 0, 1)
    })

    // should handle the storedId correctly when Insert/Upsert/Delete records
    it('should be able to operate thin cache layer correctly after operation: [Inser/Upsert/Delete]', function* () {
      const programCount = 1
      const moduleCount = 1

      const program1 = ProgramGenerator(programCount, moduleCount).pop()
      yield database.insert<ProgramSchema>('Program', program1)

      const execRet1 = yield database.upsert<ProgramSchema>('Program', program1)

      yield database.delete<ProgramSchema>('Program', {
        where: {
          _id: program1._id
        }
      })

      const execRet2 = yield database.upsert<ProgramSchema>('Program', program1)

      checkExecutorResult(execRet1, 0, 0, 1 + 1 * 2)
      checkExecutorResult(execRet2, 1, 0, 2)
    })

    it.skip('should throw when try to upsert an entry without PK property', function* () {
      const post = postGenerator(1, null).pop()
      const standardErr = PRIMARY_KEY_NOT_PROVIDED_ERR()

      delete post._id

      try {
        yield database.upsert<PostSchema>('Post', {} as any)
        throw 1
      } catch (e) {
        expect(standardErr.message).to.equal(standardErr.message)
      }

      yield database.dispose()
    })

  })

  describe('Query relational data', () => {
    const { program, modules, engineers } = relationalDataGenerator()

    beforeEach(function* () {
      yield database.insert('Program', program)
      yield database.insert('Module', modules)
      yield database.insert('Engineer', engineers)
    })

    it('should get correct result', function* () {
      const task = taskGenerator(1).pop()
      yield database.insert('Task', task)

      const rets = yield database.get<TaskSchema>('Task').values()

      expect(rets).to.have.lengthOf(1)
      expect(rets[rets.length - 1]).deep.equal(task)
    })

    it('should be able to handle self-join', function* () {
      const [ ret ] = yield database.get('Program').values()

      const programCopy = clone(program)
      const modulesCopy = clone(modules)
      const engineersCopy = clone(engineers)

      programCopy.modules = modulesCopy.filter(m => m.parentId === programCopy._id)
      programCopy.owner = engineersCopy.find(e => e._id === programCopy.ownerId)
      modulesCopy.forEach(m => {
        m.programmer = engineersCopy.find(e => e._id === m.ownerId)
      })

      expect(ret).to.deep.equal(programCopy)
    })

    it('should be able to handle circular reference', function* () {
      const [ programRet ] = yield database.get('Program').values()
      const [ engineerRet ] = yield database.get('Engineer', {
        where: {
          _id: program.ownerId
        }
      }).values()

      expect(programRet._id).to.deep.equal(engineerRet.leadProgram[0]._id)
      expect(programRet.owner.leadProgram).is.undefined
      expect(engineerRet.leadProgram[0].owner).is.undefined
    })
  })

})
