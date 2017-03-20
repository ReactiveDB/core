import { describe, it } from 'tman'
import { expect } from 'chai'
import { definition, Relationship, RDBType, NotImplemented, UnexpectedRelationship } from '../../../index'

export default describe('Helper - definition Testcase: ', () => {

  describe('Func: create', () => {

    it('should be able to create a basic column definition', () => {
      const def = definition.create('foo', true, RDBType.INTEGER)
      expect(def).to.deep.equal({
        column: 'foo',
        id: true
      })
    })

    it('should be able to create a `LiteralArray` typed column definition', () => {
      const def = definition.create('bar', false, RDBType.LITERAL_ARRAY)
      expect(def).to.deep.equal({
        column: 'bar',
        id: false,
        type: 'LiteralArray'
      })
    })

  })

  describe('Func: revise', () => {

    it('should revise the definition based on oneToOne relationship', () => {
      const fixture = {
        foo: {
          column: 'id',
          id: true
        }
      }
      const def = definition.revise(Relationship.oneToOne, fixture)

      expect(def).to.deep.equal({
        foo: {
          column: 'id',
          id: false
        }
      })
    })

    it('should revise the definition based on oneToMany relationship', () => {
      const fixture = {
        column: 'id',
        id: true
      }
      const def = definition.revise(Relationship.oneToMany, fixture)

      expect(def).to.deep.equal([fixture])
    })

    it('should revise the definition based on manyToMany relationship', () => {
      const fixture = {
        column: 'id',
        id: true
      }

      const check = () => definition.revise(Relationship.manyToMany, fixture)

      expect(check).to.throw(NotImplemented().message)
    })

    it('should throw if a incorrect relationship was deteched', () => {
      const fixture = {
        foo: {
          column: 'foo',
          id: true
        }
      }
      const check = () => definition.revise(123 as any, fixture)

      expect(check).to.throw(UnexpectedRelationship().message)
    })

  })

})
