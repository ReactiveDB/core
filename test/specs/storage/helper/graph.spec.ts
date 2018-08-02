import { beforeEach, it, describe } from 'tman'
import { expect } from 'chai'
import { graph } from '../../../../src/storage/helper'
import { GraphFailed } from '../../../index'

export default describe('Helper - Graph Testcase: ', () => {
  let data: Object[]
  let definition: Object

  beforeEach(() => {
    data = [
      {
        id: 1,
        foo: 'foo',
      },
      {
        id: 1,
        foo: 'bar',
      },
      {
        id: 2,
        foo: 'baz',
      },
    ]

    definition = {
      id: {
        column: 'id',
      },
      foo: [{ content: { column: 'foo' } }],
    }
  })

  it('should merge data as definition', () => {
    const result = graph(data, definition)
    const expectResult = [
      {
        id: 1,
        foo: [
          {
            content: 'foo',
          },
          {
            content: 'bar',
          },
        ],
      },
      {
        id: 2,
        foo: [
          {
            content: 'baz',
          },
        ],
      },
    ]

    expect(result).deep.equal(expectResult)
  })

  it('should throw when definition is unsuitable', () => {
    const check = () => graph(data, { baz: {} })
    const err = new Error("invalid structPropToColumnMap format - property 'baz' can not be an empty object")
    const standardErr = GraphFailed(err)

    expect(check).to.throw(standardErr.message)
  })
})
