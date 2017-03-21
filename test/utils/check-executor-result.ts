import { expect } from 'chai'
import { ExecutorResult } from '../index'

export const checkExecutorResult =
  function (result: ExecutorResult, insertCount: number = 0, deleteCount: number = 0, updateCount: number = 0) {
    expect(result.result).to.equal(true)
    expect(result).have.property('insert', insertCount)
    expect(result).have.property('delete', deleteCount)
    expect(result).have.property('update', updateCount)
  }
