import { Observable, Scheduler } from 'rxjs'
import * as moment from 'moment'
import { describe, it, beforeEach, afterEach } from 'tman'
import { expect, assert, use } from 'chai'
import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'
import { uuid, checkExecutorResult } from '../../utils'
import schemaFactory from '../../schemas'
import { TestFixture2 } from '../../schemas/Test'
import { scenarioGen, programGen, postGen, taskGen, subtaskGen } from '../../utils/generators'
import { RDBType, DataStoreType, Database, clone, forEach, JoinMode } from '../../index'
import { TaskSchema, ProjectSchema, PostSchema, ModuleSchema, ProgramSchema, SubtaskSchema } from '../../index'
import { InvalidQuery, NonExistentTable, InvalidType, PrimaryKeyNotProvided, NotConnected, Selector, UnexpectedTransactionUse } from '../../index'

use(SinonChai)

const FoolishTable = 'Undefined-Table'

export default describe('Database Testcase: ', () => {

  let database: Database
  let version = 0

  const taskCleanup = (tasks: TaskSchema[]) =>
    tasks.forEach(t => {
      delete t.project
      delete t.subtasks
    })

  const refreshDB = () => {
    version++
    database = new Database(DataStoreType.MEMORY, false, `test:${version}`, version)
    schemaFactory(database)
  }

  beforeEach(() => {
    refreshDB()
  })

  it('should be instantiated successfully', () => {
    expect(database).to.be.instanceof(Database)
  })

  it('should mount database$ on instance', () => {
    expect(database.database$).to.be.instanceof(Observable)
  })

  describe('Method: connect', () => {

    beforeEach(() => {
      database.connect()
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should store [[schemas]]', () => {
      const schema = database['schemas'].get('Task')

      expect(new Set(schema.columns.keys())).to.deep.equal(new Set([
        '_creatorId',
        '_executorId',
        '_projectId',
        '_id',
        '_sourceId',
        '_stageId',
        '_tasklistId',
        'accomplished',
        'content',
        'note',
        'subtasksCount',
        'involveMembers',
        'created'
      ]))
      expect(schema.associations.get('project').name).to.equal('Project')
      assert.isFunction(schema.associations.get('project').where)
    })

    it('should store primaryKey', () => {
      database['schemas'].forEach((schema) => {
        expect(schema.pk).is.not.null
      })
    })

    it('should throw if RDBType is incorrect', () => {
      const testDb = new Database()
      TestFixture2(testDb)

      const standardErr = InvalidType()
      try {
        testDb.connect()
        throw new Error('error path reached')
      } catch (err) {
        expect(err.message).to.equal(standardErr.message)
      }
    })

  })

  describe('Method: dispose', () => {

    it('should throw if invoke dispose before connect', function* () {
      try {
        yield database.dispose()
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.equal(NotConnected().message)
      }
    })

  })

  describe('Database.prototype.dump', () => {

    beforeEach(() => {
      database.connect()
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should be able to dump the data that is already stored in database', function*() {
      const ret = yield database.dump()
      expect(ret).is.ok
    })

  })

  describe('Method: insert', () => {

    beforeEach(() => {
      database.connect()
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should be able to insert single record', function*() {
      const [ fixture ] = taskGen(1)
      taskCleanup([fixture])

      const execRet = yield database.insert('Task', fixture)
      const [ task ] = yield database.get('Task', {
        where: { _id: fixture._id }
      }).values()

      taskCleanup([task])

      checkExecutorResult(execRet, 1, 0, 0)
      expect(task).to.deep.equal(fixture)
    })

    it('should be able to insert multi records', function* () {
      const fixtures = taskGen(10)
      taskCleanup(fixtures)
      const execRet = yield database.insert('Task', fixtures)

      const tasks = yield database.get('Task').values()
      taskCleanup(tasks)

      checkExecutorResult(execRet, 10, 0, 0)
      expect(tasks).to.deep.equal(fixtures)
    })

    it('shouldn\'t insert column which is unspecified in schema', function* () {
      const [ fixture ] = subtaskGen(1, '233')
      const dest = clone(fixture)
      fixture['foo'] = '1'
      fixture['bar'] = 2

      const execRet = yield database.insert('Subtask', fixture)

      const [ subtask ] = yield database.get('Subtask', {
        where: { _id: fixture._id }
      }).values()

      checkExecutorResult(execRet, 1, 0, 0)
      expect(subtask).to.deep.equal(dest)
    })

    it('should throw if user try to insert entries into non-existent table', function* () {
      try {
        yield database.insert(FoolishTable, {})
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.equal(NonExistentTable(FoolishTable).message)
      }
    })

    it('should throw if failed to execute transaction', function*() {
      const [ fixture ] = taskGen(1)
      delete fixture._stageId

      try {
        yield database.insert('Task', fixture)
        throw new Error('error code path')
      } catch (e) {
        expect(e.code).to.equal(202) // lovefield error code
        expect(e.message).to.not.equal('error code path')
      }

    })

  })

  describe('Method: get', () => {

    let fixture: TaskSchema[]
    let target: TaskSchema = null
    const maxCount = 50

    const getId = (tasks: TaskSchema[]) =>
      tasks.map(t => t._id).sort()

    const keys = (obj: any) => Object.keys(obj)

    beforeEach(function* () {
      database.connect()
      fixture = taskGen(maxCount)
      target = fixture[0]
      taskCleanup(fixture)
      yield database.insert('Task', fixture)
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should get value when pk clause was specified', function* () {
      const [ { _id } ] = yield database.get<TaskSchema>('Task', {
        where: {
          _id: target._id
        }
      }).values()

      expect(_id).to.equal(target._id)
    })

    it('should get value when multi clause were specified', function* () {
      const [ { _id, _projectId } ] = yield database.get<TaskSchema>('Task', {
        where: {
          _id: target._id,
          _projectId: target._projectId
        }
      }).values()

      expect(_id).to.equal(target._id)
      expect(_projectId).to.equal(target._projectId)
    })

    it('on query without `where`, should result in QueryToken whose Selector does not have predicateProvider', function* () {
      yield database.get<TaskSchema>('Task', {}).selector$
        .subscribeOn(Scheduler.async)
        .do((x: Selector<TaskSchema>) => {
          expect(x.predicateProvider).to.be.undefined
        })
    })

    it('should get single record successfully', function* () {
      const result = yield database.get<TaskSchema>('Task', {
        where: { _id: target._id }
      }).values()

      expect(result[0]._id).to.equal(target._id)
      expect(result).have.lengthOf(1)
    })

    it('should get multi record successfully', function* () {
      const result: TaskSchema[] = yield database.get<TaskSchema>('Task').values()
      expect(getId(result)).to.deep.equal(getId(fixture))
      expect(result).have.lengthOf(maxCount)
    })

    it('should get record with correct property based on query', function* () {
      const [ result ] = yield database.get<TaskSchema>('Task', {
        where: { _id: target._id },
        fields: ['_id']
      }).values()

      expect(result).to.have.property('_id')
      expect(keys(result)).to.deep.equal(['_id'])
      expect(result._id).to.equal(target._id)
    })

    it('should get records with correct property based on query', function* () {
      const result = yield database.get<TaskSchema>('Task', {
        fields: ['_id']
      }).values()

      expect(result).have.lengthOf(maxCount)
      expect(getId(result)).to.deep.equal(getId(fixture))
      result.forEach((r: any) => {
        expect(r).to.have.property('_id')
        expect(keys(r)).to.deep.equal(['_id'])
      })
    })

    it('should get record with multi properties based on query', function* () {
      const fields = ['_id', 'note', 'content', '_creatorId', 'subtasksCount']
      const [ result ] = yield database.get<TaskSchema>('Task', {
        where: { _id: target._id },
        fields: fields
      }).values()

      expect(result).to.have.property('_id')
      expect(result).to.have.property('note')
      expect(result).to.have.property('content')
      expect(result).to.have.property('_creatorId')
      expect(result).to.have.property('subtasksCount')
      expect(keys(result)).to.deep.equal(fields)
    })

    it('should get records with multi properties based on query', function* () {
      const fields = ['_id', 'note', 'content', '_creatorId', 'subtasksCount']
      const result = yield database.get<TaskSchema>('Task', {
        fields: fields
      }).values()

      expect(result).to.have.lengthOf(maxCount)
      expect(getId(result)).to.deep.equal(getId(fixture))

      result.forEach((r: any) => {
        expect(r).to.have.property('_id')
        expect(r).to.have.property('note')
        expect(r).to.have.property('content')
        expect(r).to.have.property('_creatorId')
        expect(r).to.have.property('subtasksCount')
        expect(keys(r)).to.deep.equal(fields)
      })
    })

    it('should be able to get property which is stored as hidden column', function* () {
      const [ result ] = yield database.get<TaskSchema>('Task', {
        fields: ['involveMembers']
      }).values()

      expect(result).to.have.property('involveMembers')
      expect(result.involveMembers).to.deep.equal(target.involveMembers)
    })

    it('should get empty array if no record matched query', function* () {
      const result = yield database.get<TaskSchema>('Task',
        { where: { _id: 'testtask' } }
      ).values()

      expect(result).to.deep.equal([])
    })

    it('should be able to get result even pass in a incorrect query', function* () {
      const [ result ] = yield database.get<TaskSchema>('Task', {
        fields: ['_id', { [FoolishTable] : ['_id'] } ],
        where: { _id: target._id }
      }).values()

      expect(result).have.property('_id', target._id)
    })

    it('should be able to get result even a incorrect field was queried', function* () {
      const undef = 'UNDEF'

      const [ result ] = yield database.get<TaskSchema>('Task', {
        fields: [undef, 'note'],
        where: { _id: target._id }
      }).values()

      expect(result.note).to.equal(target.note)
      expect(result).to.have.not.property(undef)
    })

    it('should throw if try to get data from a non-existent table', function* () {
      try {
        yield database.get(FoolishTable).values()
        throw new Error('error path reached')
      } catch (e) {
        const standardErr = NonExistentTable(FoolishTable)
        expect(e.message).equals(standardErr.message)
      }
    })

    it('should be worked with `skip` clause', function* () {
      const result = yield database.get('Task', { skip: 20 }).values()
      taskCleanup(result)

      yield Observable.from(fixture)
        .skip(20)
        .toArray()
        .do(r => {
          expect(r).to.deep.equal(result)
        })
    })

    it('should be worked with `limit` clause', function* () {
      const result = yield database.get('Task', { limit: 10 }).values()
      taskCleanup(result)

      yield Observable.from(fixture)
        .take(10)
        .toArray()
        .do(r => {
          expect(r).to.deep.equal(result)
        })
    })

    it('should be worked with both skip and limit', function* () {
      const result = yield database.get('Task', { limit: 10, skip: 20 }).values()
      taskCleanup(result)

      yield Observable.from(fixture)
        .skip(20)
        .take(10)
        .toArray()
        .do(r => {
          expect(r).to.deep.equal(result)
        })
    })

    it('should get records with order', function* () {
      yield database.insert('Task', fixture)

      const result = yield database.get('Task', {
        orderBy: [
          { orderBy: 'ASC', fieldName: 'subtasksCount' },
          { orderBy: 'DESC', fieldName: 'created' },
        ]
      }).values()

      taskCleanup(result)

      fixture.sort((x, y) => {
        const moreSubtasks = Math.sign(x.subtasksCount - y.subtasksCount)
        const earlier = -Math.sign(new Date(x.created).valueOf()
                                    - new Date(y.created).valueOf())
        return moreSubtasks * 10 + earlier
      })
        .forEach((r, i) => {
          expect(r).to.deep.equal(result[i])
        })
    })

    it('should keep the idempotency of query', function* () {
      const sqlA = yield database.get('Task').toString()
      const sqlB = yield database.get('Task').toString()

      expect(sqlA).to.deep.equal(sqlB)
    })

    describe('case: Associations', () => {

      let associationFixture: TaskSchema[] = []
      let innerTarget: TaskSchema = null

      beforeEach((done) => {
        refreshDB()
        database.connect()

        associationFixture = taskGen(50)
        innerTarget = associationFixture[0]

        const subtasks: SubtaskSchema[] = []
        const projects: ProjectSchema[] = []
        const posts: PostSchema[] = []
        const tasks: TaskSchema[] = []

        associationFixture.forEach(f => {
          forEach(f, (value, key) => {
            if (key === 'subtasks') {
              subtasks.push(...value)
            } else if (key === 'project') {
              if (value.posts) {
                posts.push(...value.posts)
              }
              projects.push(value)
            }
          })
          tasks.push(f)
        })

        const queries = [
          database.insert('Task', tasks),
          database.insert('Subtask', subtasks),
          database.insert('Project', projects),
          database.insert('Post', posts)
        ]

        Observable.forkJoin(...queries).subscribe(() => {
          done()
        })
      })

      afterEach(() => {
        database.dispose()
      })

      it('should get association with properties based on query', function* () {
        const refFields = ['_id', 'name']
        const [ result ] = yield database.get<TaskSchema>('Task', {
          fields: ['_id', { project: refFields }],
          where: { _id: innerTarget._id }
        }).values()

        expect(result).to.have.property('project')
        expect(keys(result.project)).to.deep.equal(refFields)
      })

      it('should apply `skip` clause on multi joined query', function* () {
        const result = yield database.get('Task', { skip: 20 }).values()

        yield Observable.from(associationFixture)
          .skip(20)
          .toArray()
          .do(r => {
            expect(r).to.deep.equal(result)
          })
      })

      it('should be worked with `limit` clause on multi joined query', function* () {
        const result = yield database.get('Task', { limit: 10 }).values()

        yield Observable.from(associationFixture)
          .take(10)
          .toArray()
          .do(r => {
            expect(r).to.deep.equal(result)
          })
      })

      it('should be worked with both skip and limit on multi joined query', function* () {
        const result = yield database.get('Task', { limit: 10, skip: 20 }).values()

        yield Observable.from(associationFixture)
          .skip(20)
          .take(10)
          .toArray()
          .do(r => {
            expect(r).to.deep.equal(result)
          })
      })

      it('should throw if only navigator was included in query', function* () {

        try {
          yield database.get('Task', {
            fields: [ 'project', 'subtasks' ],
            where: { _id: innerTarget._id }
          }).values()

          throw new Error('error path reached')
        } catch (err) {
          const standardErr = InvalidQuery()
          expect(err.message).to.equal(standardErr.message)
        }
      })

      it('should throw if failed to build where-clause, and treat it as an empty where-clause', function* () {
        let result: any[]

        const throwingWhereStmt = {
          get whatever() {
            throw new TypeError('error occured when build execute where clause function')
          }
        }

        try {
          result = yield database.get<TaskSchema>('Task', {
            where: throwingWhereStmt
          } as any).values()
        } catch (e) {
          throw new TypeError('Invalid code path reached.')
        }

        expect(result).to.have.length.above(0)

        try {
          result = yield database.get<TaskSchema>('Task', {
            where: throwingWhereStmt,
            limit: 20,
            skip: 0
          } as any).values()
        } catch (e) {
          throw new TypeError('Invalid code path reached.')
        }

        expect(result).to.have.length(20)
      })

    })

  })

  describe('Method: update', () => {

    let fixture: TaskSchema[]
    let target: TaskSchema
    const maxCount = 20

    beforeEach(function* () {
      database.connect()
      fixture = taskGen(maxCount)
      target = fixture[0]
      taskCleanup(fixture)
      yield database.insert('Task', fixture)
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('shouldn\'t to update column which is defined as primarykey', function* () {
      const note = 'foo'
      yield database.update('Task', target._id as any, {
        _id: 'bar',
        note
      })

      const [ result ] = yield database.get('Task', {
        where: { _id: target._id }
      }).values()

      expect(result._id).to.equal(target._id)
      expect(result.note).to.equal(note)
    })

    it('should be able to update bulk records', function* () {
      const newCreated = new Date(2017, 0, 1)
      const data = {
        created: newCreated.toISOString()
      }

      yield database.update('Task', {
        created: {
          $isNotNull: true
        }
      }, data)

      const results = yield database.get<TaskSchema>('Task', {
        fields: ['created']
      }).values()

      results.forEach((r: any) => {
        expect(r.created).to.deep.equal(newCreated.toISOString())
      })
    })

    it('should be able to update records more than one time', function* () {
      const clause = {
        _id: target._id
      }

      const u1 = uuid()
      const u2 = uuid()

      yield database.update<TaskSchema>('Task', clause, {
        _stageId: u1
      })

      const [ r1 ] = yield database.get('Task', {
        where: {
          _stageId: u1
        }
      }).values()

      yield database.update<TaskSchema>('Task', clause, {
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

    it('should be able to update property which is stored as hidden column', function* () {
      const newCreated = new Date(2017, 1, 1)
      yield database.update<TaskSchema>('Task', {
        _id: target._id
      }, {
        created: newCreated.toISOString()
      })

      const [ result ] = yield database.get<TaskSchema>('Task', {
        fields: ['created']
      }).values()

      expect(result.created).to.deep.equal(newCreated.toISOString())
    })

    it('should be able to update record based on pk clause', function* () {
      const patchData = {
        note: 'foo'
      }

      yield database.update<TaskSchema>('Task', {
        _id: target._id
      }, patchData)

      const [ result ] = yield database.get<TaskSchema>('Task', {
        where: {
          note: 'foo'
        }
      }).values()

      expect(result._id).to.equal(target._id)
      expect(result.note).to.equal('foo')
    })

    it('shouldn\'t throw if try to update records without clause', function* () {
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

    it('should throw if patching data is plural', function* () {
      const results = yield database.get<TaskSchema>('Task').values()
      const patch = results.map((ret: TaskSchema) => {
        return { ...ret, content: 'bar' }
      })

      try {
        yield database.update('Task', {
          _id: {
            $isNotNull: true
          }
        }, patch)
        throw new Error('error code path')
      } catch (e) {
        const standardErr = InvalidType(['Object', 'Array'])
        expect(e.message).to.equal(standardErr.message)
      }
    })

    it('should be able to update a empty table which contain a hidden column', (done) => {
      const tmpDB = new Database(DataStoreType.MEMORY, false, `test:${++version}`, version)
      const T = 'FooTable'

      tmpDB.defineSchema<any>(T, {
        id: {
          type: RDBType.NUMBER,
          primaryKey: true
        },
        members: {
          type: RDBType.LITERAL_ARRAY
        }
      })

      const errSpy = sinon.spy((): void => void 0)

      tmpDB.connect()
      tmpDB.update(T, { id: 1 } as any, {
        members: ['1', '2']
      })
      .catch(errSpy)
      .finally(() => {
        expect(errSpy).not.be.called
        tmpDB.dispose()
        done()
      })
      .subscribe()
    })

    it('should throw if try to update records from a non-existent table', function* () {
      try {
        yield database.update(FoolishTable, {}, {})
        throw new Error('error path reached')
      } catch (e) {
        const standardErr = NonExistentTable(FoolishTable)
        expect(e.message).equals(standardErr.message)
      }
    })

  })

  describe('Method: delete', () => {

    let fixture: TaskSchema[] = []
    let target: TaskSchema = null
    const maxCount = 20

    beforeEach(function* () {
      fixture = taskGen(maxCount)
      target = fixture[0]
      taskCleanup(fixture)
      database.connect()
      yield database.insert('Task', fixture)
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should delete correct values based on clause', function* () {
      const testDate = moment()
      const count = fixture.filter(task => {
        return moment(task.created).valueOf() <= testDate.valueOf()
      }).length

      yield database.delete('Task', {
        created: {
          $gte: testDate.valueOf()
        }
      })

      const result = yield database.get<TaskSchema>('Task').values()
      if (result.length) {
        expect(result).to.have.lengthOf(count)
      } else {
        expect(result).deep.equal([])
      }
    })

    it('should delete correct values based on pk caluse', function* () {
      yield database.delete('Task', {
        _id: target._id
      })

      const result = yield database.get('Task', {
        where: { _id: target._id }
      }).values()

      expect(result).deep.equal([])
    })

    it('should throw if try to delete records from non-existent table', function* () {
      try {
        yield database.delete(FoolishTable)
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.equal(NonExistentTable(FoolishTable).message)
      }
    })

  })

  describe('Method: upsert', () => {

    beforeEach(() => {
      database.connect()
    })

    afterEach(function* () {
      yield database.dispose()
    })

   it('should be able to upsert single record', function* () {
      const post = postGen(1, null).pop()
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
      const posts: PostSchema[] = postGen(10, null)
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

    it('should be able to upsert single record and its association', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = programGen(programCount, moduleCount).pop()
      const execRet = yield database.upsert<ProgramSchema>('Program', program)

      const [ ret ] = yield database.get<ProgramSchema>('Program', {
        where: {
          _id: program._id
        }
      }).values()

      expect(ret).to.deep.equal(program)
      checkExecutorResult(execRet, programCount + (moduleCount * 2))
    })

    it('should be able to upsert multi records and their association', function* () {
      const programCount = 2
      const moduleCount = 8

      const programs = programGen(programCount, moduleCount)
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

    it('should be merge duplicated record which have same id. [1]', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = programGen(programCount, moduleCount).pop()
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

    it('should be merge duplicated record which have same id. [2]', function* () {
      const programCount = 1
      const moduleCount = 1

      const program = programGen(programCount, moduleCount).pop()
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

      const program = programGen(programCount, moduleCount).pop()
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

    it('should be able to handle the records which contained duplicated association correctly', function* () {
      const programCount = 1
      const moduleCount = 1

      const program1 = programGen(programCount, moduleCount).pop()
      const program2 = programGen(programCount, moduleCount).pop()

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

    it('should use `update` to handle the record which is already stored.', function* () {
      const programCount = 2
      const moduleCount = 4

      const program1 = programGen(programCount, moduleCount).pop()
      const program2 = programGen(programCount, moduleCount).pop()

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

    it('should be able to process thin cache layer correctly after operation: [Inser/Upsert/Delete]', function* () {
      const programCount = 1
      const moduleCount = 1

      const [ program ] = programGen(programCount, moduleCount)

      delete program.modules
      delete program.owner

      yield database.insert<ProgramSchema>('Program', program)

      const execRet1 = yield database.upsert<ProgramSchema>('Program', program)

      // todo(dingwen): delete 的参数究竟需不需要 where
      yield database.delete<ProgramSchema>('Program', { _id: program._id })

      const execRet2 = yield database.upsert<ProgramSchema>('Program', program)

      checkExecutorResult(execRet1, 0, 0, 1)
      checkExecutorResult(execRet2, 1, 0, 0)
    })

    it('should be able to handle `null` as entities', function* () {
      const ret = yield database.upsert<PostSchema>('Post', null)
      expect(ret.result).to.equal(false)
    })

    it('should throw since entry does not contain PK property', function* () {
      const post = postGen(1, null).pop()
      const standardErr = PrimaryKeyNotProvided()

      delete post._id

      try {
        yield database.upsert<PostSchema>('Post', {} as any)
        throw 1
      } catch (e) {
        expect(standardErr.message).to.equal(standardErr.message)
      }
    })

    it('should throw when user try to upsert entries into a non-existent table', function* () {
      try {
        yield database.upsert(FoolishTable, {})
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.equal(NonExistentTable(FoolishTable).message)
      }
    })

    it('should throw if failed to execute transaction', function*() {
      const [ program ] = programGen(1, 1)
      delete program.ownerId

      try {
        yield database.upsert('Program', program)
        throw new Error('error code path')
      } catch (e) {
        expect(e.code).to.equal(202) // lovefield error code
        expect(e.message).to.not.equal('error code path')
      }

    })

  })

  describe('Method: remove', () => {

    beforeEach(() => {
      database.connect()
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should remove single record without [dispose/@@dispose] correctly', function* () {
      const [ program ] = programGen(1, 1)

      yield database.upsert('Engineer', program.owner)
      const ret1 = yield database.get('Engineer').values()
      const execRet = yield database.remove('Engineer')
      const ret2 = yield database.get('Engineer').values()

      checkExecutorResult(execRet, 0, 1, 0)
      expect(ret1).have.lengthOf(1)
      expect(ret2).to.deep.equal([])
    })

    it('should remove multi record without [dispose/@@dispose] correctly', function* () {
      const programs = programGen(10, 10)
      const engineers = programs.map(p => p.owner)

      const engineerCount = new Set(engineers.map((e: any) => e._id)).size

      yield database.upsert('Engineer', engineers)
      const ret1 = yield database.get('Engineer').values()
      const execRet = yield database.remove('Engineer')
      const ret2 = yield database.get('Engineer').values()

      checkExecutorResult(execRet, 0, 1, 0)
      expect(ret1).have.lengthOf(engineerCount)
      expect(ret2).to.deep.equal([])
    })

    it('should call @@dispose which is defined in schema', function* () {
      const programCount = 3
      const moduleCount = 20

      const programs = programGen(programCount, moduleCount)
      yield database.upsert('Program', programs)

      const execRet = yield database.remove('Program')
      const ret1 = yield database.get('Program').values()
      const ret2 = yield database.get('Module').values()

      checkExecutorResult(execRet, 0, 1 + moduleCount * 2, 0)
      expect(ret1).to.deep.equal([])
      expect(ret2).to.deep.equal([])
    })

    it('should call dispose which is defined in schema', function* () {
      const programCount = 10
      const moduleCount = 20

      const programs = programGen(programCount, moduleCount)
      const engineerIds: string[] = Array.from(new Set(
        programs
          .map(p => p.modules)
          .reduce((acc, pre) => acc.concat(pre))
          .map((m: any) => m.ownerId)
        )
      )
      yield database.upsert('Program', programs)

      const clause = { where: { _id: { $in: engineerIds } } }
      const storedEngineers = yield database.get('Engineer', clause).values()

      const execRet = yield database.remove('Module')
      const ret1 = yield database.get('Module').values()
      const ret2 = yield database.get('Engineer', clause).values()

      checkExecutorResult(execRet, 0, 1 + engineerIds.length, 0)
      expect(storedEngineers).to.have.lengthOf(engineerIds.length)
      expect(ret1).to.deep.equal([])
      expect(ret2).to.deep.equal([])
    })

    it('should be able to remove the row\'s Pk in thin cache layer', function* () {
      const programCount = 10
      const moduleCount = 20

      const programs = programGen(programCount, moduleCount)
      const ret1 = yield database.upsert('Program', programs)
      yield database.remove('Program')
      const ret2 = yield database.upsert('Program', programs)

      // if method: `remove` was implemented correctly
      // the result of repeated `upsert` execution should be equal
      expect(ret2).to.deep.equal(ret1)
    })

    it('should throw when user try to remove entries from a non-existent table', function* () {
      const tableName = '__NON_EXISTENT_TABLE__'
      try {
        yield database.remove(tableName)
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.equal(NonExistentTable(tableName).message)
      }
    })

  })

  describe('case: Relational Scenario', () => {

    const { program, modules, engineers } = scenarioGen()

    beforeEach(function* () {
      database.connect()
      yield database.insert('Program', program)
      yield database.insert('Module', modules)
      yield database.insert('Engineer', engineers)
    })

    afterEach(function* () {
      yield database.dispose()
    })

    it('should get correct result', function* () {
      const task = taskGen(1).pop()
      yield database.upsert('Task', task)

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

    it('should be able to handle circular reference in imlicit mode', function* () {
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

    it('should be able to handle circular reference in explicit mode', function* () {
      const [ programRet ] = yield database.get('Program', {
        fields: ['_id', 'name', {
          owner: ['_id', 'name']
        }]
      }).values()

      const [ engineerRet ] = yield database.get('Engineer', {
        where: {
          _id: program.ownerId
        },
        fields: ['_id', 'name', {
          leadProgram: ['_id', 'owner']
        }]
      }, JoinMode.explicit).values()

      expect(programRet._id).to.deep.equal(engineerRet.leadProgram[0]._id)
      expect(programRet.owner.leadProgram).is.undefined
      expect(engineerRet.leadProgram[0].owner).to.deep.equal(programRet.owner)
    })

  })

  describe('Method: transaction', () => {

    beforeEach(() => {
      database.connect()
    })

    it('should able to create a transaction scope for multi query [1]', (done) => {
      const programCount = 10
      const moduleCount = 20

      const programs1 = programGen(programCount, moduleCount)
      const programs2 = programGen(programCount, moduleCount)

      database.get('Program').changes()
        .skip(1)
        .subscribe((r) => {
          // 第一次的更新推送就输出了 2次 upsert 的执行结果
          expect(r.length).to.equal(programCount * 2)
          done()
          // 这里会导致没办法 afterEach hook, 故暂时先删除
        })

      database.transaction()
        .concatMap(([ db, tx ]) =>
          db.upsert('Program', programs1)
            .concatMap(() => db.upsert('Program', programs2))
            .concatMap(() => tx.commit())
        )
        .subscribe()
    })

    it('should able to create a transaction scope for multi query [2]', function* () {
      const posts1 = postGen(10, 'goog')
      const posts2 = postGen(10, 'facebook')

      const ret = yield database.transaction()
        .concatMap(([ db, tx ]) => {
          return db.upsert('Post', posts1)
            .concatMap(() => db.upsert('Post', posts2))
            .concatMap(() => tx.commit())
        })

      checkExecutorResult(ret, 20)
    })

    it('should able to create a transaction scope for multi query [3]', function* () {
      const posts1 = postGen(10, 'goog')
      const posts2 = postGen(10, 'facebook')

      const ret = yield database.transaction()
        .concatMap(([ db, tx ]) => {
          return db.insert('Post', posts1)
            .concatMap(() => db.insert('Post', posts2))
            .concatMap(() => tx.commit())
        })

      checkExecutorResult(ret, 20)
    })

    it('should able to create a transaction scope for multi query [4]', function* () {
      const posts1 = postGen(10, 'goog')
      const posts2 = postGen(10, 'facebook')

      yield database.insert('Post', posts1.concat(posts2))

      const ret = yield database.transaction()
        .concatMap(([ db, tx ]) => {
          return db.delete('Post', { where: { _id: { $in: posts1.map(p => p._id) } } })
            .concatMap(() => db.delete('Post', { where: { _id: { $in: posts2.map(p => p._id) } } }))
            .concatMap(() => tx.commit())
        })

      checkExecutorResult(ret, 0, 2)
    })

    it('should able to create a transaction scope for multi query [5]', function* () {
      const posts1 = postGen(10, 'goog')
      const posts2 = postGen(10, 'facebook')

      yield database.insert('Post', posts1.concat(posts2))

      const ret = yield database.transaction()
        .concatMap(([ db, tx ]) => {
          return db.remove('Post', { where: { _id: { $in: posts1.map(p => p._id) } } })
            .concatMap(() => db.remove('Post', { where: { _id: { $in: posts2.map(p => p._id) } } }))
            .concatMap(() => tx.commit())
        })

      checkExecutorResult(ret, 0, 2)
    })

    it('should able to create a transaction scope for multi query [6]', function* () {
      const programs = programGen(10, 10)

      yield database.upsert('Program', programs)

      const ret = yield database.transaction()
        .concatMap(([ db, tx ]) => {
          return db.remove('Program')
            .concatMap(() => tx.commit())
        })

      checkExecutorResult(ret, 0, 10 + 10 + 1)
    })

    it('should be able to cancel the side-effects if error was thrown', function* () {
      const [ program ] = programGen(1, 1)
      const ownerId = program.ownerId

      delete program.ownerId
      delete program.owner
      delete program.modules

      try {
        yield database.transaction()
          .concatMap(([ db, tx ]) => {
            return db.upsert('Program', program).concatMap(() => tx.commit())
          })
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.not.equal('error code path')

        const ret = yield database.upsert('Program', { ...program, ownerId })
        checkExecutorResult(ret, 1)
      }
    })

    it('should be able to abort the transaction', function* () {
      const programCount = 10
      const moduleCount = 20

      const programs1 = programGen(programCount, moduleCount)
      const programs2 = programGen(programCount, moduleCount)

      const ret = yield database.transaction()
        .concatMap(([ db, tx ]) => {
          return db.upsert('Program', programs1)
            .concatMap(() => db.upsert('Program', programs2))
            .concatMap(() => {
              tx.abort()
              return tx.commit()
            })
        })

      checkExecutorResult(ret)
    })

    it('should throw if call attachTx directly', () => {
      try {
        database.attachTx({ next: () => console.info(1) })
        throw new Error('error code path')
      } catch (e) {
        expect(e.message).to.equal(UnexpectedTransactionUse().message)
      }
    })

  })

})
