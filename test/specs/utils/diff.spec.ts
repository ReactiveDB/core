import { describe, it } from 'tman'
import { expect } from 'chai'
import { diff, patch, getPatchResult } from '../../../src/utils/diff'

export default describe('Diff Testcase: ', () => {
  describe('Function: diff', () => {
    it('should be able to throw: 1', () => {
      const oldList = [{ id: 1 }]
      const newList = { id: 1 }
      const result = diff(oldList, newList as any, 'id')
      expect(result.type).to.equal(0)
      expect(result.message).to.equal(`cannot compare non-list object`)
    })

    it('should be able to throw: 2', () => {
      const oldList = { id: 1 }
      const newList = [{ id: 1 }]
      const result = diff(oldList as any, newList, 'id')
      expect(result.type).to.equal(0)
      expect(result.message).to.equal(`cannot compare non-list object`)
    })

    it('should be able to throw: 3', () => {
      const result = diff([1], [2], 'id')
      expect(result.type).to.equal(0)
      expect(result.message).to.equal(`cannot find pk: id at prev.0`)
    })

    it('should be able to throw: 4', () => {
      const result = diff([{ id: 1 }], [2] as any, 'id')
      expect(result.type).to.equal(0)
      expect(result.message).to.equal(`cannot find pk: id at curr.0`)
    })

    it('should be able to detect changes between two list: 1', () => {
      const oldList = [{ id: 1 }]
      const newList = [{ id: 2 }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 2', () => {
      const oldList = [{ id: 1 }]
      const newList = [{ id: 1 }, { id: 2 }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(2)
      expect(result.ops[0].type).to.equal(0)
    })

    it('should be able to detect changes between two list: 3', () => {
      const oldList = [{ id: 1 }]
      const newList = [{ id: 2 }, { id: 1 }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(2)
      expect(result.ops[0].type).to.equal(1)
      expect(result.ops[1].type).to.equal(0)
    })

    it('should be able to detect changes between two list: 4', () => {
      const result = diff([{ id: 1 }], [], 'id')
      expect(result.ops.length).to.equal(0)
    })

    it('should be able to detect changes between two list: 5', () => {
      const oldList = [{ id: 1, a: [] as any[] }]
      const newList = [{ id: 1, a: [] as any[] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(0)
    })

    it('should be able to detect changes between two list: 6', () => {
      const oldList = [{ id: 1, a: [] as any[] }]
      const newList = [{ id: 1, a: {} }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 7', () => {
      const oldList = [{ id: 1, a: {} }]
      const newList = [{ id: 1, a: [] as any[] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 8', () => {
      const oldList = [{ id: 1, a: [1, 2] }]
      const newList = [{ id: 1, a: [1, 2, 3] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 9', () => {
      const oldList = [{ id: 1, a: [{}, {}] }]
      const newList = [{ id: 1, a: [{}, {}, {}] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 10', () => {
      const oldList = [{ id: 1, a: [{ a: 1 }, { b: 2 }] }]
      const newList = [{ id: 1, a: [{ a: 1 }, { b: 2 }] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(0)
    })

    it('should be able to detect changes between two list: 11', () => {
      const oldList = [{ id: 1, a: [{ a: 1 }, { b: 'b' }] }]
      const newList = [{ id: 1, a: [{ a: 1 }, { b: 2 }] }]
      const result = diff(oldList, newList as any, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 12', () => {
      const oldList = [{ id: 1, a: { a: 1, b: 2 } }]
      const newList = [{ id: 1, a: { a: 1, b: 2, c: 3 } }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 13', () => {
      const oldList = [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date() }] }]
      const newList = [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date(1970) }] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 14', () => {
      const oldList = [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date(1970) }] }]
      const newList = [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date(1970) }] }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(0)
    })

    it('should be able to detect changes between two list: 15', () => {
      const oldList = [{ id: 1, a: [{ a: 1 }, { b: 'b', c: '1' }, { c: new Date(1970) }] }]
      const newList = [{ id: 1, a: [{ a: 1 }, { b: 'b', v: 'v' }, { c: new Date(1970) }] }]
      const result = diff(oldList, newList as any, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 16', () => {
      const oldList = [{ id: 1, a: [{ a: 1 }, { b: 'b', c: '1' }, { c: new Date(1970) }] }]
      const newList = [{ id: 1, a: [{ a: 1 }, { b: 'b', c: '1' }, { c: new Date(1970) }] }]

      const result = diff(oldList, newList as any, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(0)
    })

    it('should be able to detect changes between two list: 17', () => {
      const result = diff([{ id: 1, a: new Date(1970) }], [{ id: 1, a: {} }], 'id')
      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 18', () => {
      const result = diff([{ id: 1, a: new Date(1970) }], [{ id: 2, a: {} }], 'id')
      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 19', () => {
      const result = diff([{ id: 1, a: new Date(1970) }], [{ id: 2, a: new Date(1970) }], 'id')
      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(1)
    })

    it('should be able to detect changes between two list: 19', () => {
      const oldList = [
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
      ]
      const newList = [
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
      ]
      const result = diff(oldList, newList, 'id')
      expect(result.ops.length).to.equal(4)
      result.ops.forEach((op: any) => {
        expect(op.type).to.equal(0)
      })
    })

    it('should be able to detect changes between two list: 20', () => {
      const oldList = [
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
      ]
      const newList = [{ id: 4, a: new Date(1970) }]
      const result = diff(oldList, newList, 'id')

      expect(result.ops.length).to.equal(1)
      expect(result.ops[0].type).to.equal(0)
      expect(result.ops[0].index).to.equal(3)
    })

    it('should be able to detect changes between two list: 21', () => {
      const oldList = [
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
      ]
      const newList = [
        { id: 4, a: new Date(1970) },
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
      ]

      const result = diff(oldList, newList, 'id')
      expect(result.ops.length).to.equal(4)
      expect(result.ops[0].type).to.equal(0)
      expect(result.ops[0].index).to.equal(3)

      expect(result.ops[1].type).to.equal(0)
      expect(result.ops[1].index).to.equal(0)

      expect(result.ops[2].type).to.equal(0)
      expect(result.ops[2].index).to.equal(1)

      expect(result.ops[3].type).to.equal(0)
      expect(result.ops[3].index).to.equal(2)
    })

    it('should be able to detect changes between two list: 22', () => {
      const oldList = [] as any[]
      const newList = [
        { id: 4, a: new Date(1970) },
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
      ]
      const result = diff(oldList, newList, 'id')
      expect(result.ops.length).to.equal(4)
      result.ops.forEach((op: any) => expect(op.type).to.equal(1))
    })

    it('should be able to detect changes between two list: 23', () => {
      const oldList = [
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
      ]
      const newList = [{ id: 2, a: new Date(1970) }, { id: 4, a: new Date(1970) }, { id: 1, a: new Date(1970) }]
      const result = diff(oldList, newList, 'id')
      expect(result.ops.length).to.equal(3)

      expect(result.ops[0].type).to.equal(0)
      expect(result.ops[0].index).to.equal(1)

      expect(result.ops[1].type).to.equal(0)
      expect(result.ops[1].index).to.equal(3)

      expect(result.ops[2].type).to.equal(0)
      expect(result.ops[2].index).to.equal(0)
    })

    it('should be able to detect changes between two list: 24', () => {
      const oldList = [
        { id: 1, a: new Date(1970) },
        { id: 2, a: new Date(1970) },
        { id: 3, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
      ]
      const newList = [
        { id: 2, a: new Date(1970) },
        { id: 4, a: new Date(1970) },
        { id: 1, a: new Date(1970) },
        { id: 5, a: new Date(1970) },
      ]
      const result = diff(oldList, newList, 'id')
      expect(result.ops.length).to.equal(4)

      expect(result.ops[0].type).to.equal(0)
      expect(result.ops[0].index).to.equal(1)

      expect(result.ops[1].type).to.equal(0)
      expect(result.ops[1].index).to.equal(3)

      expect(result.ops[2].type).to.equal(0)
      expect(result.ops[2].index).to.equal(0)

      expect(result.ops[3].type).to.equal(1)
      expect(result.ops[3].index).to.equal(3)
    })

    it('should be able to detect changes between two list: 25', () => {
      const result = diff([], [], 'id')
      expect(result.ops.length).to.equal(0)
    })

    it('should be able to use old list when they are the same: 26', () => {
      const result = diff([{ id: 1, a: 1 }], [{ id: 1, a: 1 }], 'id')
      expect(result.type).to.equal(2)
    })
  })

  describe('Function: getPatchResult', () => {
    it('should return newList with errorType', () => {
      const oldList = {} as any
      const newList = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const ops = { type: 0, ops: [] as any[], message: '' }
      expect(getPatchResult(oldList, newList, ops)).to.equal(newList)
    })

    it('should return oldList with successAndSkipType', () => {
      const oldList = [{ id: 1 }, { id: 2 }]
      const newList = [{ id: 1 }, { id: 2 }]
      const ops = { type: 2, ops: [] as any[], message: '' }
      expect(getPatchResult(oldList, newList, ops)).to.equal(oldList)
    })

    it('should apply patch with successType', () => {
      const oldList = [{ id: 1 }, { id: 2 }]
      const newList = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const ops = { type: 1, ops: [{ type: 0, index: 0 }, { type: 0, index: 1 }, { type: 1, index: 2 }], message: '' }
      const result = getPatchResult(oldList, newList, ops)
      expect(result.length).to.equal(3)
      expect(result[0]).to.equal(oldList[0])
      expect(result[1]).to.equal(oldList[1])
      expect(result[2]).to.equal(newList[2])
    })
  })

  describe('Function: patch', () => {
    it('should patch data with ops: 1', () => {
      const oldList = [{ id: 1 }, { id: 2 }]
      const newList = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const { ops } = diff(oldList, newList, 'id')
      const result = patch(ops, oldList, newList)
      expect(result[0]).to.equal(oldList[0])
      expect(result[1]).to.equal(oldList[1])
      expect(result[2]).to.equal(newList[2])
    })

    it('should patch data with ops: 2', () => {
      const oldList = [] as any
      const newList = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const { ops } = diff(oldList, newList, 'id')
      const result = patch(ops, oldList, newList)
      expect(result[0]).to.equal(newList[0])
      expect(result[1]).to.equal(newList[1])
      expect(result[2]).to.equal(newList[2])
    })
  })
})
