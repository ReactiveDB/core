'use strict'
import * as chai from 'chai'
import { forEach, clone } from '../index'
import { describe, it } from 'tman'

const expect = chai.expect

export default describe('utils test', () => {
  it('forEach should ok', () => {
    const testObject = {
      a: 1,
      b: 2,
      c: 3,
      d: {
        e: 4
      }
    }
    let times = 0
    forEach(testObject, () => {
      times ++
    })
    expect(times).to.equal(4)

    const testArray = [
      0,
      1,
      2,
      3,
      4,
      5
    ]

    times = 0

    forEach(testArray, () => {
      times ++
    })

    expect(times).to.equal(6)
  })

  it('forEach break should ok', () => {
    const arr = [0, 1, 2, 3, 4]
    const dest: number[] = []
    forEach(arr, ele => {
      if (ele === 2) {
        return false
      }
      return dest.push(ele)
    })
    expect(dest.length).to.equal(2)
  })

  it('inverse forEach should ok', () => {
    const arr = [
      0,
      1,
      2,
      3,
      4,
      5
    ]
    const result: number[] = []
    forEach(arr, (val) => {
      result.push(val)
    }, true)
    expect(result).to.eql(arr.slice(0).reverse())
  })

  it('inverse forEach break should ok', () => {
    const arr = [0, 1, 2, 3, 4]
    const dest: number[] = []
    forEach(arr, ele => {
      if (ele === 1) {
        return false
      }
      return dest.push(ele)
    }, true)
    expect(dest.length).to.equal(3)
  })

  it('forEach object should ok', () => {
    const obj = {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5
    }
    const arr: any[] = []
    const dest = [1, 2, 3, 4, 5]
    forEach(obj, val => {
      arr.push(val)
    })
    expect(arr).to.deep.equal(dest)
  })

  it('forEach object break should ok', () => {
    const obj = {
      a: 1,
      b: 2,
      c: 3,
      d: 4,
      e: 5
    }
    const arr: any[] = []
    const dest = [1, 2, 3]
    forEach(obj, val => {
      if (val === 4) {
        return false
      }
      return arr.push(val)
    })
    expect(arr).to.deep.equal(dest)
  })

  it('clone should ok', () => {
    const obj = {
      a: [1, 2, 3],
      b: 1,
      c: {
        a: 1,
        b: 2,
        c: 3
      },
      d: new Date(),
      f: '1',
      e: false,
      g: true
    }

    expect(clone(obj)).deep.equals(obj)
  })

})
