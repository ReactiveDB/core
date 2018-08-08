import { forEach, clone, getType, assert, hash, tryCatch } from '../../index'
import { describe, it } from 'tman'
import { expect } from 'chai'

export default describe('Utils Testcase: ', () => {
  describe('Func: forEach', () => {
    describe('Array Iteration', () => {
      it('should be able to execute successfully', () => {
        const fixture = [1, 2, 3, 4, 5, 6]
        const dest: number[] = []

        forEach(fixture, (el) => {
          dest.push(el)
        })

        expect(dest).is.deep.equal(fixture)
      })

      it('should be able to get Index during iteration', () => {
        const fixture = [0, 1, 2, 3, 4, 5]
        const dest: number[] = []

        forEach(fixture.map((e) => e * 2), (_, index) => {
          dest.push(index)
        })

        expect(dest).is.deep.equal(fixture)
      })

      it('should be able to break the iteration', () => {
        const arr = [0, 1, 2, 3, 4]
        const dest: number[] = []

        forEach(arr, (ele) => {
          if (ele === 2) {
            return false
          }
          return dest.push(ele)
        })

        expect(dest).to.have.lengthOf(2)
      })

      it('should be iterated inversely', () => {
        const arr = [0, 1, 2, 3, 4, 5]
        const result: number[] = []

        forEach(
          arr,
          (val) => {
            result.push(val)
          },
          true,
        )

        expect(result).to.eql(arr.reverse())
      })

      it('should be able to break the inverse iteration', () => {
        const arr = [0, 1, 2, 3, 4]
        const dest: number[] = []

        forEach(
          arr,
          (ele) => {
            if (ele === 1) {
              return false
            }
            return dest.push(ele)
          },
          true,
        )

        expect(dest).to.have.lengthOf(3)
      })
    })

    describe('Object Iteration', () => {
      it('should be able to execute successfully', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 }
        const dest = [1, 2, 3, 4, 5]
        const arr: number[] = []

        forEach(obj, (val) => {
          arr.push(val)
        })

        expect(arr.sort((x, y) => x - y)).to.deep.equal(dest)
      })

      it('should be able to get Key during iteration', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 }
        const dest = Object.keys(obj).sort()
        const arr: string[] = []

        forEach(obj, (_, key) => {
          arr.push(key)
        })

        expect(arr.sort()).to.deep.equal(dest)
      })

      it('should be able to break the iteration', () => {
        const obj = { a: 1, b: 2, c: 3, d: 4, e: 5 }
        const arr: any[] = []
        const dest = [1, 2, 3]

        forEach(obj, (val) => {
          if (val === 4) {
            return false
          }
          return arr.push(val)
        })

        expect(arr).to.deep.equal(dest)
      })
    })

    describe('Set Iteration', () => {
      it('should be able to execute successfully', () => {
        const origin = [1, 2, 3, 4, 5]
        const set = new Set(origin)
        const total = origin.reduce((pre, curr) => pre + curr)

        let count = 0
        forEach(set, (val, key) => {
          count += val
          expect(val).is.equal(key)
        })

        expect(count).is.equal(total)
      })

      it('should be able to get Key during iteration', () => {
        const origin = [1, 2, 3, 4, 5]
        const set = new Set(origin)
        const arr: any[] = []

        forEach(set, (_, key) => {
          arr.push(key)
        })

        expect(arr.sort()).is.deep.equal(origin.sort())
      })

      it('should be able to break the iteration', () => {
        const arr = [1, 2, 3, 4, 5]
        const set = new Set(arr)
        const ret: number[] = []

        forEach(set, (val) => {
          if (val === 2) {
            return false
          }
          return ret.push(val)
        })

        expect(ret).have.lengthOf(1)
      })
    })

    describe('Map Iteration', () => {
      it('should be able to execute successfully', () => {
        const kv: any = [['a', 1], ['b', 2], ['c', 3]]
        const map = new Map(kv)

        const arr: number[] = []

        forEach(map, (val) => {
          arr.push(val)
        })

        expect(arr.sort((x, y) => x - y)).is.deep.equal([1, 2, 3])
      })

      it('should be able to get Key during iteration', () => {
        const kv: [string, number][] = [['a', 1], ['b', 2], ['c', 3]]
        const map = new Map(kv)

        const dest = kv.map(([key]) => key)
        const arr: string[] = []

        forEach(map, (_, key) => {
          arr.push(key)
        })

        expect(arr.sort()).is.deep.equal(dest)
      })

      it('should be able to break the iteration', () => {
        const kv: [string, number][] = [['a', 1], ['b', 2], ['c', 3]]
        const map = new Map(kv)
        const dest: number[] = []

        forEach(map, (val) => {
          if (val === 2) {
            return false
          }
          return dest.push(val)
        })

        expect(dest).have.lengthOf(1)
      })
    })
  })

  describe('Func: getType', () => {
    const checkList = [
      { src: null, type: 'Null' },
      { src: new Date(), type: 'Date' },
      { src: [] as any[], type: 'Array' },
      { src: /\w/, type: 'RegExp' },
      { src: 'str', type: 'String' },
      { src: 1, type: 'Number' },
      { src: {}, type: 'Object' },
      { src: (): void => void 0, type: 'Function' },
      {
        src: function(): void {
          return void 0
        },
        type: 'Function',
      },
      { src: undefined, type: 'Undefined' },
    ]

    checkList.forEach((item) => {
      it(`should return type: ${item.type} correctly`, () => {
        expect(getType(item.src)).is.equal(item.type)
      })
    })
  })

  describe('Func: clone', () => {
    it('should be able to handle Array', () => {
      const fixture = [1, 2, 3, [4, 5, 6]]
      const cloned = clone(fixture)

      cloned.push(99)
      cloned.splice(1, 1)

      expect(cloned).to.deep.equal([1, 3, [4, 5, 6], 99])
      expect(fixture).to.deep.equal([1, 2, 3, [4, 5, 6]])
    })

    it('should be able to handle Object', () => {
      const fixture = { a: 1, b: 2, c: { d: 4, e: { f: 5 } } }
      const cloned = clone(fixture) as any

      cloned.a = 'foo'
      delete cloned.c

      expect(cloned).to.deep.equal({ a: 'foo', b: 2 })
      expect(fixture).to.deep.equal({ a: 1, b: 2, c: { d: 4, e: { f: 5 } } })
    })

    it('should be able to handle Boolean', () => {
      const fixture = true
      expect(clone(fixture)).to.deep.equal(fixture)
    })

    it('should be able to handle Function', () => {
      const fixture1 = (): void => void 0
      const fixture2 = function(): void {
        return void 0
      }

      expect(clone(fixture1)).to.equal(fixture1)
      expect(clone(fixture2)).to.equal(fixture2)
    })

    it('should be able to handle Regexp', () => {
      const fixture = /\w*/
      const cloned = clone(fixture)

      fixture.lastIndex = 10

      expect(cloned).to.deep.equal(/\w*/)
      expect(cloned.lastIndex).to.deep.equal(0)
    })

    it('should be able to handle Date', () => {
      const superLonelyDate = new Date(2011, 10, 11, 11, 11, 11)
      const cloned = clone(superLonelyDate)

      cloned.setMonth(0)
      cloned.setDate(1)
      cloned.setHours(0)
      cloned.setSeconds(0)
      cloned.setMinutes(0)

      expect(cloned).to.deep.equal(new Date(2011, 0, 1, 0, 0, 0))
      expect(superLonelyDate).to.deep.equal(new Date(2011, 10, 11, 11, 11, 11))
    })

    it('should be able to handle Undefined', () => {
      const fixture: any = undefined
      expect(clone(fixture)).to.equal(fixture)
    })

    it('should be able to handle Null', () => {
      const fixture: any = null
      expect(clone(fixture)).to.equal(fixture)
    })

    it('should be able to handle Complex Object', () => {
      const standardDate = new Date()

      const fixture = {
        a: [1, 2, 3],
        b: 4,
        c: {
          a: 5,
          b: 6,
          c: {
            a: 7,
            b: [8, 9, 10],
          },
        },
        d: standardDate,
        f: 'f',
        e: false,
        g: true,
        h: /\w*/,
      }

      const sealed = {
        a: [1, 2, 3],
        b: 4,
        c: {
          a: 5,
          b: 6,
          c: {
            a: 7,
            b: [8, 9, 10],
          },
        },
        d: standardDate,
        f: 'f',
        e: false,
        g: true,
        h: /\w*/,
      }

      const modifed = {
        a: [10, 20, 30],
        b: 40,
        c: {
          a: 50,
          b: 60,
          c: {
            a: 70,
            b: [80, 90, 100],
          },
        },
        d: standardDate,
        f: 'f',
        e: false,
        g: true,
        h: /\w*/,
      }

      const cloned = clone(fixture)
      const mul = (e: number) => e * 10
      cloned.a = cloned.a.map(mul)
      cloned.b = mul(cloned.b)
      cloned.c = {
        a: mul(cloned.c.a),
        b: mul(cloned.c.b),
        c: {
          a: mul(cloned.c.c.a),
          b: cloned.c.c.b.map(mul),
        },
      }

      expect(cloned).to.deep.equal(modifed)
      expect(fixture).to.deep.equal(sealed)
    })
  })

  describe('Func: assert', () => {
    it('should throw when assert failed [1]', () => {
      const check = () => assert(false, (msg: string) => new Error(msg), 'failed')
      expect(check).to.throw('failed')
    })

    it('should throw when assert failed [2]', () => {
      const check = () => assert(false, 'failed')
      expect(check).to.throw('failed')
    })

    it('should not throw when assert successed', () => {
      const check = () => assert(true, 'error code path')
      expect(check).to.not.throw()
    })

    it('should not execute error function when assert condition is met', () => {
      let x = 0
      assert(true, () => {
        x++
        return new Error('failed')
      })
      expect(x).to.equal(0)
    })
  })

  describe('Func: hash', () => {
    it('should be able to convert string to hash', () => {
      expect(hash('')).to.equal(0)
      expect(hash(' ')).to.equal(32)
      expect(hash('  ')).to.equal(1024)
    })
  })

  describe('Func: tryCatch', () => {
    const mayThrow = (flag: boolean): string => {
      const value = String(flag)
      if (flag) {
        throw new Error(value)
      } else {
        return value
      }
    }

    const tryCatchMayThrow = tryCatch(mayThrow)

    it("should return correct Value if the unwrapped function doesn't throw", () => {
      const args: [boolean] = [false]
      const unwrappedResult = mayThrow(...args)

      expect(tryCatchMayThrow()(...args)).to.deep.equal({
        kind: 'value',
        unwrapped: unwrappedResult,
      })
    })

    it('should return correct Exception if the unwrapped function throws', () => {
      const args: [boolean] = [true]

      const result = tryCatchMayThrow()(...args)

      expect(result.kind).to.equal('exception')
      expect(result.unwrapped).to.be.instanceOf(Error)
      expect((result.unwrapped as Error).message).to.equal('true')
    })

    it(`should return correct Value if the unwrapped function doesn't throw
    \tand 'doThrow' option is true`, () => {
      const args: [boolean] = [false]
      const unwrappedResult = mayThrow(...args)

      expect(tryCatchMayThrow({ doThrow: true })(...args)).to.deep.equal({
        kind: 'value',
        unwrapped: unwrappedResult,
      })
    })

    it(`should throw correct Error if the unwrapped function throws
    \tand 'doThrow' option is true`, () => {
      const args: [boolean] = [true]

      expect(() => tryCatchMayThrow({ doThrow: true })(...args)).to.throw('true\nMoreInfo: {}')
    })

    it(`should allow caller to pass in more related error info through options,
    \tbeing utilized on exception`, () => {
      const args: [boolean] = [true]

      expect(() => tryCatchMayThrow({ doThrow: true, msg: 'hello' })(...args)).to.throw(
        'true\nMoreInfo: {"msg":"hello"}',
      )

      const result = tryCatchMayThrow({ msg: 'world' })(...args)
      expect(result.kind).to.equal('exception')
      expect((result.unwrapped as Error).message).to.equal('true\nMoreInfo: {"msg":"world"}')
    })
  })
})
