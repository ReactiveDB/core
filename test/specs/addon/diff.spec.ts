import { describe, it } from 'tman'
import { expect } from 'chai'
import { diff } from '../../index'

const createWorkerEvt = (prev: any, curr: any, callback: (r: any) => void) => {
  return {
    data: {
      payload: ['id', prev, curr, Math.random()] as any,
      chan: {
        postMessage: (ret: any) => {
          callback(ret)
        },
      } as any,
    },
  }
}

export default describe('Diff Testcase: ', () => {
  describe('Function: diff', () => {
    it('should be able to throw: 1', (done) => {
      const evt = createWorkerEvt([{ id: 1 }], { id: 1 }, (ret) => {
        expect(ret.type).to.equal(0)
        expect(ret.message).to.equal(`cannot compare non-list object`)
        done()
      })
      diff(evt)
    })

    it('should be able to throw: 2', (done) => {
      const evt = createWorkerEvt({ id: 1 }, [{ id: 1 }], (ret) => {
        expect(ret.type).to.equal(0)
        expect(ret.message).to.equal(`cannot compare non-list object`)
        done()
      })
      diff(evt)
    })

    it('should be able to throw: 3', (done) => {
      const evt = createWorkerEvt([1], [2], (ret) => {
        expect(ret.type).to.equal(0)
        expect(ret.message).to.equal(`cannot find pk: id at prev.0`)
        done()
      })
      diff(evt)
    })

    it('should be able to throw: 4', (done) => {
      const evt = createWorkerEvt([{ id: 1 }], [2], (ret) => {
        expect(ret.type).to.equal(0)
        expect(ret.message).to.equal(`cannot find pk: id at curr.0`)
        done()
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 1', () => {
      const evt = createWorkerEvt([{ id: 1 }], [{ id: 2 }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 2', () => {
      const evt = createWorkerEvt([{ id: 1 }], [{ id: 1 }, { id: 2 }], (ret) => {
        expect(ret.ops.length).to.equal(2)
        expect(ret.ops[0].type).to.equal(0)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 3', () => {
      const evt = createWorkerEvt([{ id: 1 }], [{ id: 2 }, { id: 1 }], (ret) => {
        expect(ret.ops.length).to.equal(2)
        expect(ret.ops[0].type).to.equal(1)
        expect(ret.ops[1].type).to.equal(0)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 4', () => {
      const evt = createWorkerEvt([{ id: 1 }], [], (ret) => {
        expect(ret.ops.length).to.equal(0)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 5', () => {
      const evt = createWorkerEvt([{ id: 1, a: [] }], [{ id: 1, a: [] }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(0)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 6', () => {
      const evt = createWorkerEvt([{ id: 1, a: [] }], [{ id: 1, a: {} }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 7', () => {
      const evt = createWorkerEvt([{ id: 1, a: {} }], [{ id: 1, a: [] }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 8', () => {
      const evt = createWorkerEvt([{ id: 1, a: [1, 2] }], [{ id: 1, a: [1, 2, 3] }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 9', () => {
      const evt = createWorkerEvt([{ id: 1, a: [{}, {}] }], [{ id: 1, a: [{}, {}] }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(0)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 10', () => {
      const evt = createWorkerEvt([{ id: 1, a: [{ a: 1 }, { b: 2 }] }], [{ id: 1, a: [{ a: 1 }, { b: 2 }] }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(0)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 11', () => {
      const evt = createWorkerEvt(
        [{ id: 1, a: [{ a: 1 }, { b: 'b' }] }],
        [{ id: 1, a: [{ a: 1 }, { b: 2 }] }],
        (ret) => {
          expect(ret.ops.length).to.equal(1)
          expect(ret.ops[0].type).to.equal(1)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 12', () => {
      const evt = createWorkerEvt([{ id: 1, a: { a: 1, b: 2 } }], [{ id: 1, a: { a: 1, b: 2, c: 3 } }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 13', () => {
      const evt = createWorkerEvt(
        [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date() }] }],
        [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date(1970) }] }],
        (ret) => {
          expect(ret.ops.length).to.equal(1)
          expect(ret.ops[0].type).to.equal(1)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 14', () => {
      const evt = createWorkerEvt(
        [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date(1970) }] }],
        [{ id: 1, a: [{ a: 1 }, { b: 'b' }, { c: new Date(1970) }] }],
        (ret) => {
          expect(ret.ops.length).to.equal(1)
          expect(ret.ops[0].type).to.equal(0)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 15', () => {
      const evt = createWorkerEvt(
        [{ id: 1, a: [{ a: 1 }, { b: 'b', c: '1' }, { c: new Date(1970) }] }],
        [{ id: 1, a: [{ a: 1 }, { b: 'b', v: 'v' }, { c: new Date(1970) }] }],
        (ret) => {
          expect(ret.ops.length).to.equal(1)
          expect(ret.ops[0].type).to.equal(1)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 16', () => {
      const evt = createWorkerEvt(
        [{ id: 1, a: [{ a: 1 }, { b: 'b', c: '1' }, { c: new Date(1970) }] }],
        [{ id: 1, a: [{ a: 1 }, { b: 'b', c: '1' }, { c: new Date(1970) }] }],
        (ret) => {
          expect(ret.ops.length).to.equal(1)
          expect(ret.ops[0].type).to.equal(0)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 17', () => {
      const evt = createWorkerEvt([{ id: 1, a: new Date(1970) }], [{ id: 1, a: {} }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 18', () => {
      const evt = createWorkerEvt([{ id: 1, a: new Date(1970) }], [{ id: 2, a: {} }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 19', () => {
      const evt = createWorkerEvt([{ id: 1, a: new Date(1970) }], [{ id: 2, a: new Date(1970) }], (ret) => {
        expect(ret.ops.length).to.equal(1)
        expect(ret.ops[0].type).to.equal(1)
      })
      diff(evt)
    })

    it('should be able to detect changes between two list: 19', () => {
      const evt = createWorkerEvt(
        [
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
        ],
        [
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
        ],
        (ret) => {
          expect(ret.ops.length).to.equal(4)
          ret.ops.forEach((op: any) => {
            expect(op.type).to.equal(0)
          })
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 20', () => {
      const evt = createWorkerEvt(
        [
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
        ],
        [{ id: 4, a: new Date(1970) }],
        (ret) => {
          expect(ret.ops.length).to.equal(1)
          ret.ops.forEach((op: any) => {
            expect(op.type).to.equal(0)
            expect(op.index).to.equal(3)
          })
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 21', () => {
      const evt = createWorkerEvt(
        [
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
        ],
        [
          { id: 4, a: new Date(1970) },
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
        ],
        (ret) => {
          expect(ret.ops.length).to.equal(4)
          expect(ret.ops[0].type).to.equal(0)
          expect(ret.ops[0].index).to.equal(3)

          expect(ret.ops[1].type).to.equal(0)
          expect(ret.ops[1].index).to.equal(0)

          expect(ret.ops[2].type).to.equal(0)
          expect(ret.ops[2].index).to.equal(1)

          expect(ret.ops[3].type).to.equal(0)
          expect(ret.ops[3].index).to.equal(2)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 22', () => {
      const evt = createWorkerEvt(
        [],
        [
          { id: 4, a: new Date(1970) },
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
        ],
        (ret) => {
          expect(ret.ops.length).to.equal(4)
          ret.ops.forEach((op: any) => expect(op.type).to.equal(1))
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 23', () => {
      const evt = createWorkerEvt(
        [
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
        ],
        [{ id: 2, a: new Date(1970) }, { id: 4, a: new Date(1970) }, { id: 1, a: new Date(1970) }],
        (ret) => {
          expect(ret.ops.length).to.equal(3)

          expect(ret.ops[0].type).to.equal(0)
          expect(ret.ops[0].index).to.equal(1)

          expect(ret.ops[1].type).to.equal(0)
          expect(ret.ops[1].index).to.equal(3)

          expect(ret.ops[2].type).to.equal(0)
          expect(ret.ops[2].index).to.equal(0)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 24', () => {
      const evt = createWorkerEvt(
        [
          { id: 1, a: new Date(1970) },
          { id: 2, a: new Date(1970) },
          { id: 3, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
        ],
        [
          { id: 2, a: new Date(1970) },
          { id: 4, a: new Date(1970) },
          { id: 1, a: new Date(1970) },
          { id: 5, a: new Date(1970) },
        ],
        (ret) => {
          expect(ret.ops.length).to.equal(4)

          expect(ret.ops[0].type).to.equal(0)
          expect(ret.ops[0].index).to.equal(1)

          expect(ret.ops[1].type).to.equal(0)
          expect(ret.ops[1].index).to.equal(3)

          expect(ret.ops[2].type).to.equal(0)
          expect(ret.ops[2].index).to.equal(0)

          expect(ret.ops[3].type).to.equal(1)
          expect(ret.ops[3].index).to.equal(3)
        },
      )
      diff(evt)
    })

    it('should be able to detect changes between two list: 25', () => {
      const evt = createWorkerEvt([], [], (ret) => {
        expect(ret.ops.length).to.equal(0)
      })
      diff(evt)
    })
  })
})
