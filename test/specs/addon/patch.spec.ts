import { describe, it } from 'tman'
import { expect } from 'chai'
import { patch } from '../../index'

import { taskGen } from '../../utils/generators'
import * as rnd from '../../utils/random'

const modify = (dataset: any[], size: number) => {
  const buffer: number[] = []
  const newDataset = dataset.slice(0)

  while (size !== 0) {
    const n = rnd.number(0, dataset.length - 1)
    if (buffer.indexOf(n) === -1) {
      const [newData] = taskGen(1)
      newDataset[n] = newData
      size--
      buffer.push(n)
    }
  }

  return {
    data: newDataset,
    index: buffer,
  }
}

export default describe('Patch Testcase: ', () => {
  describe('Function: diff', () => {
    it('should be able to patch: 1', () => {
      const fixtures = taskGen(100)
      const modified = modify(fixtures, 5)

      const oldList = fixtures
      const newList = modified.data

      const patcher = fixtures.map((_, i) => {
        const newIndex = modified.index.indexOf(i)
        if (newIndex >= 0) {
          return { type: 1, index: modified.index[newIndex] }
        }
        return { type: 0, index: i }
      })

      const ret: any[] = patch(patcher as any, oldList, newList)

      ret.forEach((r, i) => {
        const changedIndex = modified.index.indexOf(i)
        if (changedIndex >= 0) {
          expect(r).to.equal(modified.data[modified.index[changedIndex]])
          expect(r).not.to.equal(fixtures[i])
        } else {
          expect(r).to.equal(fixtures[i])
        }
      })
    })

    it('should be able to patch: 2', () => {
      const fixtures = taskGen(100)
      const modified: any = {
        data: [],
        index: [],
      }

      const oldList = fixtures
      const newList = modified.data

      const ret: any[] = patch([] as any, oldList, newList)

      expect(ret).to.deep.equal([])
    })

    it('should be able to patch: 3', () => {
      const fixtures: any = []
      const modified = modify(taskGen(200), 50)

      const oldList = fixtures
      const newList = modified.data

      const patcher = modified.data.map((_: any, i: number) => {
        return { type: 1, index: i }
      })

      const ret: any[] = patch(patcher as any, oldList, newList)

      ret.forEach((r, i) => {
        expect(r).to.equal(modified.data[i])
      })
    })
  })
})
