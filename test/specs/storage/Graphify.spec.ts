import { beforeEach, it, describe } from 'tman'
import { expect } from 'chai'
import graphify from '../../../src/storage/Graphify'
import { GRAPHIFY_ROWS_FAILED_ERR } from '../../index'

export default describe('Graphify test', () => {

  let data: Object[]
  let definition: Object

  beforeEach(() => {
    data = [
      {
        id: 1,
        foo: 'foo'
      },
      {
        id: 1,
        foo: 'bar'
      },
      {
        id: 2,
        foo: 'baz'
      }
    ]

    definition = {
      id: {
        column: 'id',
      },
      foo: [ {content: { column: 'foo' } } ]
    }
  })


  it('should merge data as definition', () => {
    const result = graphify(data, definition)
    let expectResult = [
      {
        id: 1,
        foo: [
          {
            content: 'foo'
          },
          {
            content: 'bar'
          }
        ]
      },
      {
        id: 2,
        foo: [
          {
            content: 'baz'
          }
        ]
      }
    ]

    expect(result).deep.equal(expectResult)
  })

  it('should throw when definition is unsuitable', () => {
    const graph = () => graphify(data, { baz: {} })
    const err = new Error('invalid structPropToColumnMap format - property \'baz\' can not be an empty object')
    const standardErr = GRAPHIFY_ROWS_FAILED_ERR(err)

    expect(graph).to.throw(standardErr.message)
  })

})
