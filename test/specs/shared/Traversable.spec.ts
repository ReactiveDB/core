import { Traversable, getType } from '../../index'
import { describe, it, beforeEach } from 'tman'
import { expect, use } from 'chai'
import * as sinon from 'sinon'
import * as SinonChai from 'sinon-chai'

use(SinonChai)

export default describe('Traversable Testcase: ', () => {
  describe('Class: Traversable', () => {
    let fixture: any
    let traversable: Traversable<any>
    let nodeOrder: any[]
    let keyOrder: any[]
    let parentOrder: any[]
    let pathOrder: any[]
    let childrenOrder: any[]

    beforeEach(() => {
      fixture = [
        {
          _id: '1',
          ownerId: '2',
          owner: {
            _id: '3',
            name: 'teh0diarsz',
          },
          modules: [
            {
              _id: 'c531fd0f',
              name: 'ljz6eexwd4',
              ownerId: '4',
              parentId: '5',
              programmer: {
                _id: '6',
                name: 'teh0diarsz',
              },
            },
          ],
        },
      ]

      nodeOrder = [
        fixture,
        fixture[0],
        fixture[0]._id,
        fixture[0].ownerId,
        fixture[0].owner,
        fixture[0].owner._id,
        fixture[0].owner.name,
        fixture[0].modules,
        fixture[0].modules[0],
        fixture[0].modules[0]._id,
        fixture[0].modules[0].name,
        fixture[0].modules[0].ownerId,
        fixture[0].modules[0].parentId,
        fixture[0].modules[0].programmer,
        fixture[0].modules[0].programmer._id,
        fixture[0].modules[0].programmer.name,
      ]

      keyOrder = [
        undefined,
        0,
        '_id',
        'ownerId',
        'owner',
        '_id',
        'name',
        'modules',
        0,
        '_id',
        'name',
        'ownerId',
        'parentId',
        'programmer',
        '_id',
        'name',
      ]

      parentOrder = [
        undefined,
        fixture,
        fixture[0],
        fixture[0],
        fixture[0],
        fixture[0].owner,
        fixture[0].owner,
        fixture[0],
        fixture[0].modules,
        fixture[0].modules[0],
        fixture[0].modules[0],
        fixture[0].modules[0],
        fixture[0].modules[0],
        fixture[0].modules[0],
        fixture[0].modules[0].programmer,
        fixture[0].modules[0].programmer,
      ]

      pathOrder = [
        [],
        [0],
        [0, '_id'],
        [0, 'ownerId'],
        [0, 'owner'],
        [0, 'owner', '_id'],
        [0, 'owner', 'name'],
        [0, 'modules'],
        [0, 'modules', 0],
        [0, 'modules', 0, '_id'],
        [0, 'modules', 0, 'name'],
        [0, 'modules', 0, 'ownerId'],
        [0, 'modules', 0, 'parentId'],
        [0, 'modules', 0, 'programmer'],
        [0, 'modules', 0, 'programmer', '_id'],
        [0, 'modules', 0, 'programmer', 'name'],
      ]

      childrenOrder = [
        [0],
        ['_id', 'ownerId', 'owner', 'modules'],
        [],
        [],
        ['_id', 'name'],
        [],
        [],
        [0],
        ['_id', 'name', 'ownerId', 'parentId', 'programmer'],
        [],
        [],
        [],
        [],
        ['_id', 'name'],
        [],
        [],
      ]

      traversable = new Traversable(fixture)
    })

    it('should can be instantiated correctly', () => {
      expect(traversable).is.instanceof(Traversable)
    })

    describe('Method: keys', () => {
      it('should be able to handle Object correctly', () => {
        const obj = { a: 1, b: 2, c: 3, d: [4] }
        const ret = traversable.keys(obj)

        expect(ret).is.deep.equal(Object.keys(obj))
      })

      it('should be able to handle Array correctly', () => {
        const array = [0, 1, 2, 3, 4, 5]
        const ret = traversable.keys(array)

        expect(ret).is.deep.equal(Array.from(array.keys()))
      })

      it('should be able to handle sorts of basic type', () => {
        const array = [/\w*/, true, false, 1, 'str', new Date(), (): void => void 0]
        array.forEach((item) => {
          const ret = traversable.keys(item)
          expect(ret).is.deep.equal([])
        })
      })
    })

    describe('Method: context', () => {
      it('should mount ctxgen function successfully', () => {
        const spy = sinon.spy()
        traversable.context(spy)
        sinon.stub(traversable, 'forEach').callsFake(function(this: any) {
          this.ctxgen()
        })

        traversable.forEach(() => void 0)
        expect(spy).to.be.called
      })
    })

    describe('Method: forEach', () => {
      it('should skip the eachFunc when returanValue of ctxgen is false', () => {
        const fn = () => false
        const spy = sinon.spy()
        traversable.context(fn).forEach(spy)

        expect(spy).is.not.be.called
      })

      it('should execute the eachFunc when returanValue of ctxgen is true', () => {
        const fn = () => true
        const spy = sinon.spy()
        traversable.context(fn).forEach(spy)

        expect(spy.callCount).is.equal(16)
      })

      it('should take the returnValue of ctxgen as eachFunc first parameter', () => {
        const ctx = { foo: 1, bar: 2 }
        const fn = () => ctx
        const spy = sinon.spy()
        traversable.context(fn).forEach(spy)

        expect(spy.callCount).is.equal(16)
        for (let i = 0; i < spy.callCount; i++) {
          expect(spy.getCall(i).args[0]).to.have.property('foo', 1)
          expect(spy.getCall(i).args[0]).to.have.property('bar', 2)
        }
      })

      it('should iterate every node', () => {
        let index = 0
        traversable.forEach((ctx, node) => {
          expect(ctx.node).to.equal(nodeOrder[index])
          expect(node).to.equal(nodeOrder[index])
          index++
        })
      })

      it('should be able to use `context.isRoot`', () => {
        traversable.forEach((ctx, node) => {
          if (node === fixture) {
            expect(ctx.isRoot).to.equal(true)
          } else {
            expect(ctx.isRoot).to.equal(false)
          }
        })
      })

      it('should be able to use `context.isLeaf`', () => {
        traversable.forEach((ctx, node) => {
          if (
            node === fixture ||
            node === fixture[0] ||
            node === fixture[0].owner ||
            node === fixture[0].modules ||
            node === fixture[0].modules[0] ||
            node === fixture[0].modules[0].programmer
          ) {
            expect(ctx.isLeaf).to.equal(false)
          } else {
            expect(ctx.isLeaf).to.equal(true)
          }
        })
      })

      it('should be able to use `context.index`', () => {
        let index = 0
        traversable.forEach((ctx) => {
          expect(ctx.index).to.equal(index)
          index++
        })
      })

      it('should be able to skip iteration of children when `context.skip` is called', () => {
        traversable.forEach((ctx, node) => {
          if (ctx.isRoot) {
            ctx.skip()
          } else {
            node['@@tag'] = true
          }
        })

        nodeOrder.forEach((n) => expect(n['@@tag']).to.not.equal(true))
      })

      it('should be able to get nodeType via `context.type`', () => {
        traversable.forEach((ctx, node) => {
          expect(ctx.type()).to.equal(getType(node))
        })
      })

      it('should be able to get node from `context.node` and second parameter of eachFunc', () => {
        traversable.forEach((ctx, node) => {
          expect(ctx.node).to.equal(node)
        })
      })

      it("should be able to get node's keyIndex via `context.key`", () => {
        let index = 0
        traversable.forEach((ctx) => {
          expect(ctx.key).to.equal(keyOrder[index])
          index++
        })
      })

      it('should be able to get parent of current node via `context.parent`', () => {
        let index = 0
        traversable.forEach((ctx) => {
          if (ctx.isRoot) {
            expect(ctx.parent).to.equal(undefined)
          } else {
            expect(ctx.parent).to.equal(parentOrder[index])
          }
          index++
        })
      })

      it('should be able to get traverse path via `context.path`', () => {
        let index = 0
        traversable.forEach((ctx) => {
          expect(ctx.path).to.deep.equal(pathOrder[index])
          index++
        })
      })

      it("should be able to get keyIndex of node's children via `context.children`", () => {
        let index = 0
        traversable.forEach((ctx) => {
          expect(ctx.children).to.deep.equal(childrenOrder[index])
          index++
        })
      })
    })
  })
})
